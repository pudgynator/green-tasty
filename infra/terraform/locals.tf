locals {
  api_handler_name     = "api-handler"
  reports_handler_name = "reports-handler"
  report_sender_name   = "report-sender"
  api_gateway_name     = "restaurant-backend-api"
  lambda_alias_name    = "dev"
  api_stage_name       = "develop"

  # Syndicate lambda_config.json lists 128 MB. The .NET 10 packages (QuestPDF, NPOI,
  # ImageSharp) do not start reliably at that size.
  api_handler_memory_mb     = 512
  report_sender_memory_mb   = 512
  reports_handler_memory_mb = 256
  lambda_timeout_seconds    = 100
}
