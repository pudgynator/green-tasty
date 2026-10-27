using System.ComponentModel.DataAnnotations;

namespace APIHandler.Models.GuestSessions;

public class SubmitGroupPreOrderRequest
{
    [Required]
    public string? ReservationId { get; set; }
}
