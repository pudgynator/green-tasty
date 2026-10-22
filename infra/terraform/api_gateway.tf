resource "aws_api_gateway_rest_api" "backend" {
  name = local.api_gateway_name

  body = templatefile("${path.module}/api-spec.yaml.tftpl", {
    lambda_invoke_arn     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_alias.api_handler.arn}/invocations"
    cognito_user_pool_arn = aws_cognito_user_pool.backend.arn
  })

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_handler.function_name
  qualifier     = aws_lambda_alias.api_handler.name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.backend.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "backend" {
  rest_api_id = aws_api_gateway_rest_api.backend.id

  triggers = {
    redeployment = sha1(aws_api_gateway_rest_api.backend.body)
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [aws_lambda_permission.api_gateway]
}

resource "aws_api_gateway_stage" "develop" {
  rest_api_id   = aws_api_gateway_rest_api.backend.id
  deployment_id = aws_api_gateway_deployment.backend.id
  stage_name    = local.api_stage_name
}

output "api_gateway_url" {
  description = "Invoke URL for the develop stage. Use this as BACKEND_URL."
  value       = aws_api_gateway_stage.develop.invoke_url
}

output "api_gateway_id" {
  value = aws_api_gateway_rest_api.backend.id
}
