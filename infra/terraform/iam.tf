# IAM role/policy used by the EventBridge Scheduler to invoke report-sender.
# Lambda execution roles are defined in lambda.tf.

resource "aws_iam_role" "event_bridge" {
  name = "event-bridge-role"
  path = "/"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = { Service = "scheduler.amazonaws.com" }
      },
    ]
  })
}

resource "aws_iam_policy" "event_bridge" {
  name = "event-bridge-policy"
  path = "/"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = aws_lambda_function.report_sender.arn
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "event_bridge" {
  role       = aws_iam_role.event_bridge.name
  policy_arn = aws_iam_policy.event_bridge.arn
}
