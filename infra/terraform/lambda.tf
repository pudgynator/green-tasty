resource "aws_iam_role" "api_handler" {
  name = "api-handler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = { Service = "lambda.amazonaws.com" }
      },
    ]
  })
}

resource "aws_iam_role" "report_sender" {
  name = "report-sender-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = { Service = "lambda.amazonaws.com" }
      },
    ]
  })
}

resource "aws_iam_role" "reports_handler" {
  name = "reports-handler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = { Service = "lambda.amazonaws.com" }
      },
    ]
  })
}

# Same permissions the application declares in deployment_resources.json
# under the lambda-basic-execution policy.
resource "aws_iam_policy" "lambda_basic_execution" {
  name = "lambda-basic-execution"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:DeleteObject",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "dynamodb:Scan",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:PutItem",
          "dynamodb:Batch*",
          "dynamodb:DeleteItem",
          "dynamodb:UpdateItem",
          "dynamodb:DescribeTable",
          "ssm:GetParameter",
          "kms:Decrypt",
          "cognito-idp:AdminInitiateAuth",
          "cognito-idp:AdminConfirmSignUp",
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:CreateGroup",
          "cognito-idp:GetGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:ListGroups",
          "cognito-idp:ListUsersInGroup",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:ListUsers",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminListGroupsForUser",
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:ChangeMessageVisibility",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
          "ses:SendRawEmail",
        ]
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "api_handler" {
  role       = aws_iam_role.api_handler.name
  policy_arn = aws_iam_policy.lambda_basic_execution.arn
}

resource "aws_iam_role_policy_attachment" "report_sender" {
  role       = aws_iam_role.report_sender.name
  policy_arn = aws_iam_policy.lambda_basic_execution.arn
}

resource "aws_iam_role_policy_attachment" "reports_handler" {
  role       = aws_iam_role.reports_handler.name
  policy_arn = aws_iam_policy.lambda_basic_execution.arn
}

resource "aws_cloudwatch_log_group" "api_handler" {
  name              = "/aws/lambda/${local.api_handler_name}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "report_sender" {
  name              = "/aws/lambda/${local.report_sender_name}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "reports_handler" {
  name              = "/aws/lambda/${local.reports_handler_name}"
  retention_in_days = 30
}

resource "aws_lambda_function" "api_handler" {
  function_name    = local.api_handler_name
  role             = aws_iam_role.api_handler.arn
  runtime          = "dotnet10"
  handler          = "APIHandler::APIHandler.Function::FunctionHandler"
  filename         = "${path.module}/build/api-handler.zip"
  source_code_hash = filebase64sha256("${path.module}/build/api-handler.zip")
  memory_size      = local.api_handler_memory_mb
  timeout          = local.lambda_timeout_seconds
  publish          = true

  ephemeral_storage {
    size = 512
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.api_handler.name
  }

  environment {
    variables = {
      COGNITO_USER_POOL_ID              = aws_cognito_user_pool.backend.id
      COGNITO_USER_POOL_CLIENT_ID       = aws_cognito_user_pool_client.backend_api.id
      reports_queue_name                = aws_sqs_queue.reports.name
      OrderIndexReservationId           = "GSI_ReservationId"
      REGION                            = var.aws_region
      notificationsTable                = aws_dynamodb_table.notifications.name
      FEEDBACK_TABLE_NAME               = aws_dynamodb_table.feedback.name
      locationsTable                    = aws_dynamodb_table.locations.name
      WaiterListTableName               = aws_dynamodb_table.waiters.name
      tablesTable                       = aws_dynamodb_table.tables.name
      dishesTable                       = aws_dynamodb_table.dishes.name
      reservationsTable                 = aws_dynamodb_table.reservations.name
      reportsTable                      = aws_dynamodb_table.reports.name
      reportsHistoryTable               = aws_dynamodb_table.reports_history.name
      profileImagesTable                = aws_dynamodb_table.profile_images.name
      notificationsUserIdIndex          = "UserIdIndex"
      reservationsCustomerIdGlobalIndex = "GSI_UserId"
      reservationsWaiterIdGlobalIndex   = "GSI_WaiterId"
      reservationsTableGlobalIndex      = "GSI_ByTableId"
      waitersGlobalIndex                = "locationId-index"
      imagesBucketName                  = aws_s3_bucket.images.id
      profileImagesBucketName           = aws_s3_bucket.profile_images.id
      ordersTable                       = aws_dynamodb_table.orders.name
      feedbackGlobalIndex               = "locationId-createdAt-index"
      groupReservationsTable            = aws_dynamodb_table.group_reservations.name
      guestSessionTable                 = aws_dynamodb_table.guest_sessions.name
      tableLocationIdIndex              = "locationId-tableNumber-index"
    }
  }

  depends_on = [aws_iam_role_policy_attachment.api_handler]
}

resource "aws_lambda_function" "report_sender" {
  function_name    = local.report_sender_name
  role             = aws_iam_role.report_sender.arn
  runtime          = "dotnet10"
  handler          = "ReportSender::ReportSender.Function::FunctionHandler"
  filename         = "${path.module}/build/report-sender.zip"
  source_code_hash = filebase64sha256("${path.module}/build/report-sender.zip")
  memory_size      = local.report_sender_memory_mb
  timeout          = local.lambda_timeout_seconds
  publish          = true

  ephemeral_storage {
    size = 512
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.report_sender.name
  }

  environment {
    variables = {
      EmailFrom         = var.email_from
      Region            = var.aws_region
      LocationTableName = aws_dynamodb_table.locations.name
      ReportTableName   = aws_dynamodb_table.reports.name
      CognitoUserPoolId = aws_cognito_user_pool.backend.id
    }
  }

  depends_on = [aws_iam_role_policy_attachment.report_sender]
}

resource "aws_lambda_function" "reports_handler" {
  function_name    = local.reports_handler_name
  role             = aws_iam_role.reports_handler.arn
  runtime          = "dotnet10"
  handler          = "ReportsHandler::ReportsHandler.Function::FunctionHandler"
  filename         = "${path.module}/build/reports-handler.zip"
  source_code_hash = filebase64sha256("${path.module}/build/reports-handler.zip")
  memory_size      = local.reports_handler_memory_mb
  timeout          = local.lambda_timeout_seconds
  publish          = true

  ephemeral_storage {
    size = 512
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.reports_handler.name
  }

  environment {
    variables = {
      ReportsTableName = aws_dynamodb_table.reports.name
      AwsRegion        = var.aws_region
    }
  }

  depends_on = [aws_iam_role_policy_attachment.reports_handler]
}

resource "aws_lambda_alias" "api_handler" {
  name             = local.lambda_alias_name
  function_name    = aws_lambda_function.api_handler.function_name
  function_version = aws_lambda_function.api_handler.version
}

resource "aws_lambda_alias" "report_sender" {
  name             = local.lambda_alias_name
  function_name    = aws_lambda_function.report_sender.function_name
  function_version = aws_lambda_function.report_sender.version
}

resource "aws_lambda_alias" "reports_handler" {
  name             = local.lambda_alias_name
  function_name    = aws_lambda_function.reports_handler.function_name
  function_version = aws_lambda_function.reports_handler.version
}

resource "aws_lambda_event_source_mapping" "reports_queue" {
  event_source_arn                   = aws_sqs_queue.reports.arn
  function_name                      = aws_lambda_alias.reports_handler.arn
  batch_size                         = 10
  maximum_batching_window_in_seconds = 0
  function_response_types            = ["ReportBatchItemFailures"]
}
