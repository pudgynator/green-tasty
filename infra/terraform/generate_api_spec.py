#!/usr/bin/env python3
"""Build the API Gateway OpenAPI template from the app's deployment_resources.json."""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

PARAM = re.compile(r"^\{([^{}]+)\}$")

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "backend/restaurant-backend-app/deployment_resources.json"
OUTPUT = Path(__file__).resolve().parent / "api-spec.yaml.tftpl"

ALLOW_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
ALLOW_HEADERS = "Content-Type,Authorization"


def segments(path: str) -> list[str]:
    return [part for part in path.split("/") if part]


def normalize_sibling_params(resources: dict) -> dict:
    """API Gateway allows only one parameter name among sibling path parts."""
    mapping = {path: path for path in resources}
    changed = True
    while changed:
        changed = False
        groups = defaultdict(list)
        for path in mapping.values():
            parts = segments(path)
            for index, part in enumerate(parts):
                match = PARAM.match(part)
                if match:
                    groups[(tuple(parts[:index]), index)].append((path, match.group(1), index))
        for items in groups.values():
            names = {name for _, name, _ in items}
            if len(names) < 2:
                continue
            counts = Counter(name for _, name, _ in items)
            canonical = sorted(names, key=lambda name: (-counts[name], name != "id", len(name), name))[0]
            for path, name, index in items:
                if name == canonical:
                    continue
                parts = segments(path)
                parts[index] = "{" + canonical + "}"
                rewritten = "/" + "/".join(parts)
                for original, current in list(mapping.items()):
                    if current == path:
                        mapping[original] = rewritten
                changed = True

    normalized = {}
    for original, spec in resources.items():
        path = mapping[original]
        if path in normalized:
            raise SystemExit(f"path collision after rename: {original} -> {path}")
        normalized[path] = spec
    return normalized


def path_params(path: str) -> list[str]:
    names = []
    start = 0
    while True:
        open_at = path.find("{", start)
        if open_at < 0:
            return names
        close_at = path.find("}", open_at)
        names.append(path[open_at + 1 : close_at])
        start = close_at + 1


def apigw_literal(value: str) -> str:
    # API Gateway treats the value as an expression unless it is a quoted literal.
    return "\"'" + value + "'\""


def main() -> None:
    document = json.loads(SOURCE.read_text())
    resources = normalize_sibling_params(document["${api_gateway_name}"]["resources"])

    lines = [
        "openapi: '3.0.1'",
        "info:",
        "  title: restaurant-backend-api",
        "  version: '1.0'",
        "paths:",
    ]

    for path, spec in resources.items():
        methods = {
            key: value
            for key, value in spec.items()
            if key != "enable_cors" and isinstance(value, dict)
        }
        lines.append(f"  {path}:")
        params = path_params(path)
        if params:
            lines.append("    parameters:")
            for name in params:
                lines.extend(
                    [
                        f"      - name: {name}",
                        "        in: path",
                        "        required: true",
                        "        schema:",
                        "          type: string",
                    ]
                )

        for method, config in methods.items():
            secured = config.get("authorization_type") == "cognito_authorizer"
            lines.append(f"    {method.lower()}:")
            if secured:
                lines.extend(
                    [
                        "      security:",
                        "        - cognito_authorizer: []",
                    ]
                )
            lines.extend(
                [
                    "      responses:",
                    "        '200':",
                    "          description: Lambda proxy response",
                    "      x-amazon-apigateway-integration:",
                    "        type: aws_proxy",
                    "        httpMethod: POST",
                    '        uri: "${lambda_invoke_arn}"',
                    "        passthroughBehavior: when_no_match",
                ]
            )

        lines.extend(
            [
                "    options:",
                "      responses:",
                "        '200':",
                "          description: CORS preflight",
                "          headers:",
                "            Access-Control-Allow-Origin:",
                "              schema:",
                "                type: string",
                "            Access-Control-Allow-Methods:",
                "              schema:",
                "                type: string",
                "            Access-Control-Allow-Headers:",
                "              schema:",
                "                type: string",
                "      x-amazon-apigateway-integration:",
                "        type: mock",
                "        requestTemplates:",
                '          application/json: \'{"statusCode": 200}\'',
                "        passthroughBehavior: when_no_match",
                "        responses:",
                "          default:",
                "            statusCode: '200'",
                "            responseParameters:",
                f"              method.response.header.Access-Control-Allow-Origin: {apigw_literal('*')}",
                f"              method.response.header.Access-Control-Allow-Methods: {apigw_literal(ALLOW_METHODS)}",
                f"              method.response.header.Access-Control-Allow-Headers: {apigw_literal(ALLOW_HEADERS)}",
            ]
        )

    lines.extend(
        [
            "components:",
            "  securitySchemes:",
            "    cognito_authorizer:",
            "      type: apiKey",
            "      name: Authorization",
            "      in: header",
            "      x-amazon-apigateway-authtype: cognito_user_pools",
            "      x-amazon-apigateway-authorizer:",
            "        type: cognito_user_pools",
            "        providerARNs:",
            '          - "${cognito_user_pool_arn}"',
            "        identitySource: method.request.header.Authorization",
            "x-amazon-apigateway-gateway-responses:",
            "  DEFAULT_4XX:",
            "    responseParameters:",
            f"      gatewayresponse.header.Access-Control-Allow-Origin: {apigw_literal('*')}",
            f"      gatewayresponse.header.Access-Control-Allow-Headers: {apigw_literal(ALLOW_HEADERS)}",
            f"      gatewayresponse.header.Access-Control-Allow-Methods: {apigw_literal(ALLOW_METHODS)}",
            "  DEFAULT_5XX:",
            "    responseParameters:",
            f"      gatewayresponse.header.Access-Control-Allow-Origin: {apigw_literal('*')}",
            f"      gatewayresponse.header.Access-Control-Allow-Headers: {apigw_literal(ALLOW_HEADERS)}",
            f"      gatewayresponse.header.Access-Control-Allow-Methods: {apigw_literal(ALLOW_METHODS)}",
            "  UNAUTHORIZED:",
            "    responseParameters:",
            f"      gatewayresponse.header.Access-Control-Allow-Origin: {apigw_literal('*')}",
            f"      gatewayresponse.header.Access-Control-Allow-Headers: {apigw_literal(ALLOW_HEADERS)}",
            f"      gatewayresponse.header.Access-Control-Allow-Methods: {apigw_literal(ALLOW_METHODS)}",
            "  ACCESS_DENIED:",
            "    responseParameters:",
            f"      gatewayresponse.header.Access-Control-Allow-Origin: {apigw_literal('*')}",
            f"      gatewayresponse.header.Access-Control-Allow-Headers: {apigw_literal(ALLOW_HEADERS)}",
            f"      gatewayresponse.header.Access-Control-Allow-Methods: {apigw_literal(ALLOW_METHODS)}",
            "",
        ]
    )
    OUTPUT.write_text("\n".join(lines))
    print(f"wrote {OUTPUT}")


if __name__ == "__main__":
    main()
