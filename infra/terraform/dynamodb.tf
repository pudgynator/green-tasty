resource "aws_dynamodb_table" "waiters" {
  name           = "Waiters"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "locationId"
    type = "S"
  }

  global_secondary_index {
    name            = "locationId-index"
    hash_key        = "locationId"
    projection_type = "ALL"
    read_capacity   = 1
    write_capacity  = 1
  }
}

resource "aws_dynamodb_table" "feedback" {
  name           = "Feedback"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "reservationId"
  range_key      = "createdAt"

  attribute {
    name = "reservationId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "locationId"
    type = "S"
  }

  global_secondary_index {
    name            = "locationId-createdAt-index"
    hash_key        = "locationId"
    range_key       = "createdAt"
    projection_type = "ALL"
    read_capacity   = 1
    write_capacity  = 1
  }
}

resource "aws_dynamodb_table" "tables" {
  name           = "Tables"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "locationId"
    type = "S"
  }

  attribute {
    name = "tableNumber"
    type = "N"
  }

  global_secondary_index {
    name            = "locationId-tableNumber-index"
    hash_key        = "locationId"
    range_key       = "tableNumber"
    projection_type = "ALL"
    read_capacity   = 1
    write_capacity  = 1
  }
}

resource "aws_dynamodb_table" "dishes" {
  name           = "Dishes"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

resource "aws_dynamodb_table" "reservations" {
  name           = "Reservations"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "tableId"
    type = "S"
  }

  attribute {
    name = "waiterId"
    type = "S"
  }

  attribute {
    name = "customerId"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI_ByTableId"
    hash_key        = "tableId"
    projection_type = "ALL"
    read_capacity   = 1
    write_capacity  = 1
  }

  global_secondary_index {
    name            = "GSI_WaiterId"
    hash_key        = "waiterId"
    projection_type = "ALL"
    read_capacity   = 1
    write_capacity  = 1
  }

  global_secondary_index {
    name            = "GSI_UserId"
    hash_key        = "customerId"
    projection_type = "ALL"
    read_capacity   = 1
    write_capacity  = 1
  }
}

resource "aws_dynamodb_table" "locations" {
  name           = "Locations"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

resource "aws_dynamodb_table" "profile_images" {
  name           = "ProfileImages"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "userId"

  attribute {
    name = "userId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "orders" {
  name           = "Orders"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "orderId"
  range_key      = "customerId"

  attribute {
    name = "orderId"
    type = "S"
  }

  attribute {
    name = "customerId"
    type = "S"
  }

  attribute {
    name = "reservationId"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI_CustomerId"
    hash_key        = "customerId"
    projection_type = "ALL"
    read_capacity   = 1
    write_capacity  = 1
  }

  global_secondary_index {
    name            = "GSI_ReservationId"
    hash_key        = "reservationId"
    projection_type = "ALL"
    read_capacity   = 1
    write_capacity  = 1
  }
}

resource "aws_dynamodb_table" "reports" {
  name           = "Reports"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "waiterId"
  range_key      = "date"

  attribute {
    name = "waiterId"
    type = "S"
  }

  attribute {
    name = "date"
    type = "S"
  }
}

resource "aws_dynamodb_table" "reports_history" {
  name           = "ReportsHistory"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "UserIdIndex"
    hash_key        = "userId"
    projection_type = "ALL"
    read_capacity   = 1
    write_capacity  = 1
  }
}

resource "aws_dynamodb_table" "notifications" {
  name           = "Notifications"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "UserIdIndex"
    hash_key        = "userId"
    projection_type = "ALL"
    read_capacity   = 1
    write_capacity  = 1
  }
}

resource "aws_dynamodb_table" "group_reservations" {
  name           = "GroupReservations"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "groupReservationId"

  attribute {
    name = "groupReservationId"
    type = "S"
  }

  attribute {
    name = "reservationToken"
    type = "S"
  }

  attribute {
    name = "reservationId"
    type = "S"
  }

  global_secondary_index {
    name            = "reservationToken"
    hash_key        = "reservationToken"
    projection_type = "ALL"
    read_capacity   = 1
    write_capacity  = 1
  }

  global_secondary_index {
    name            = "reservationId"
    hash_key        = "reservationId"
    projection_type = "ALL"
    read_capacity   = 1
    write_capacity  = 1
  }
}

resource "aws_dynamodb_table" "guest_sessions" {
  name         = "GuestSessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "guestSessionId"

  attribute {
    name = "guestSessionId"
    type = "S"
  }

  attribute {
    name = "groupReservationId"
    type = "S"
  }

  attribute {
    name = "guestSessionTokenHash"
    type = "S"
  }

  global_secondary_index {
    name            = "groupReservationId"
    hash_key        = "groupReservationId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "guestSessionTokenHash"
    hash_key        = "guestSessionTokenHash"
    projection_type = "ALL"
  }
}
