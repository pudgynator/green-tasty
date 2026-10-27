using APIHandler.Constants.Orders;
using APIHandler.Entities;
using APIHandler.Exceptions;
using APIHandler.Repositories.Auth;
using APIHandler.Repositories.Dishes;
using APIHandler.Repositories.GroupReservations;
using APIHandler.Repositories.GuestSessions;
using APIHandler.Repositories.Orders;
using APIHandler.Repositories.Reservations;
using APIHandler.Repositories.Tables;
using APIHandler.Services.GuestSessions;
using Moq;

namespace APIHandler.Tests.Services;

public class GroupPreOrderServiceTests
{
    private readonly Mock<IGuestSessionRepository> _guestSessions = new();
    private readonly Mock<IGroupReservationRepository> _groups = new();
    private readonly Mock<IDishRepository> _dishes = new();
    private readonly Mock<IReservationRepository> _reservations = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IOrderRepository> _orders = new();
    private readonly GuestSessionService _service;

    public GroupPreOrderServiceTests()
    {
        _service = new GuestSessionService(
            _groups.Object,
            _guestSessions.Object,
            _dishes.Object,
            _reservations.Object,
            _users.Object,
            new Mock<ITableRepository>().Object,
            _orders.Object);
    }

    [Fact]
    public async Task GetGroupSessionsAsync_ReturnsParticipantsAndTotal()
    {
        var group = OpenGroup();
        var reservation = OwnerReservation(group.ReservationId);
        var sessions = new List<GuestSession>
        {
            Session("session1", "Andrii", true, ("dish1", 2)),
            Session("session2", "Olena", false, ("dish2", 1)),
        };

        SetupOwner(group, reservation, sessions);
        _dishes.Setup(repository => repository.GetDishesByIdsAsync(It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync([Dish("dish1", "Caesar Salad", 180), Dish("dish2", "Tom Yum", 220)]);

        var response = await _service.GetGroupSessionsAsync(reservation.CustomerId!, group.GroupReservationId);

        var participants = response.Participants.ToArray();
        Assert.Equal(2, participants.Length);
        Assert.Equal(360, participants[0].Total);
        Assert.True(participants[0].IsSubmitted);
        Assert.Equal(220, participants[1].Total);
        Assert.False(participants[1].IsSubmitted);
        Assert.Equal(580, response.Total);
    }

    [Fact]
    public async Task GetGroupSessionsAsync_WhenCallerIsNotOwner_ThrowsActionForbidden()
    {
        var group = OpenGroup();
        var reservation = OwnerReservation(group.ReservationId);
        SetupOwner(group, reservation, []);

        await Assert.ThrowsAsync<ActionForbiddenException>(() =>
            _service.GetGroupSessionsAsync("someone-else", group.GroupReservationId));
    }

    [Fact]
    public async Task GetOwnerGuestSessionIdAsync_ReturnsExistingOwnerSession()
    {
        var reservation = OwnerReservation("reservation-123");
        var group = OpenGroup(reservation.Id);
        var ownerSession = Session("owner-session-123", "Owner", false);
        ownerSession.IsOwnerSession = true;
        ownerSession.OwnerUserId = reservation.CustomerId;

        _reservations.Setup(repository => repository.GetReservationByIdAsync(reservation.Id)).ReturnsAsync(reservation);
        _groups.Setup(repository => repository.GetByReservationIdAsync(reservation.Id)).ReturnsAsync(group);
        _guestSessions.Setup(repository => repository.GetAllByGroupReservationIdAsync(group.GroupReservationId))
            .ReturnsAsync([ownerSession]);

        var response = await _service.GetOwnerGuestSessionIdAsync(reservation.CustomerId!, reservation.Id);

        Assert.Equal("owner-session-123", response.GuestSessionId);
    }

    [Fact]
    public async Task GetOwnerGuestSessionIdAsync_WhenGroupIsMissing_ThrowsNotFound()
    {
        var reservation = OwnerReservation("reservation-123");
        _reservations.Setup(repository => repository.GetReservationByIdAsync(reservation.Id)).ReturnsAsync(reservation);
        _groups.Setup(repository => repository.GetByReservationIdAsync(reservation.Id))
            .ReturnsAsync((GroupReservation?)null);

        await Assert.ThrowsAsync<GroupReservationNotFoundException>(() =>
            _service.GetOwnerGuestSessionIdAsync(reservation.CustomerId!, reservation.Id));
    }

    [Fact]
    public async Task SubmitGroupPreOrderAsync_MergesSubmittedDishesAndUpdatesStatuses()
    {
        var group = OpenGroup();
        var reservation = OwnerReservation(group.ReservationId);
        var sessions = new List<GuestSession>
        {
            Session("session1", "Andrii", true, ("dish1", 2), ("dish2", 1)),
            Session("session2", "Olena", true, ("dish1", 1), ("dish2", 1)),
            Session("session3", "Iryna", false, ("dish1", 9)),
        };
        var order = new Order
        {
            OrderId = "order-1",
            CustomerId = reservation.CustomerId!,
            ReservationId = reservation.Id,
            ReservationAddress = "address",
            ReservationTime = "time",
            Dishes = [],
            Status = OrderStatus.Created,
        };

        SetupOwner(group, reservation, sessions);
        _orders.Setup(repository => repository.GetOrderByReservationIdAsync(reservation.Id)).ReturnsAsync(order);

        var result = await _service.SubmitGroupPreOrderAsync(
            reservation.CustomerId!,
            group.GroupReservationId,
            reservation.Id);

        Assert.Equal([("dish1", 3), ("dish2", 2)], result.Select(dish => (dish.DishId, dish.Quantity)).ToArray());
        Assert.Equal(OrderStatus.SubmittedByCustomer, order.Status);
        Assert.Equal(GroupReservationStatus.Submitted, group.Status);
        _orders.Verify(repository => repository.SaveOrderAsync(order), Times.Once);
        _groups.Verify(repository => repository.SaveGroupReservationAsync(group), Times.Once);
    }

    [Fact]
    public async Task SubmitGroupPreOrderAsync_WhenNoSubmittedSessions_ThrowsValidationException()
    {
        var group = OpenGroup();
        var reservation = OwnerReservation(group.ReservationId);
        SetupOwner(group, reservation, [Session("session1", "Olena", false, ("dish2", 1))]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            _service.SubmitGroupPreOrderAsync(reservation.CustomerId!, group.GroupReservationId, reservation.Id));
    }

    [Fact]
    public async Task SubmitGroupPreOrderAsync_WhenSubmittedSessionsHaveNoDishes_ThrowsValidationException()
    {
        var group = OpenGroup();
        var reservation = OwnerReservation(group.ReservationId);
        SetupOwner(group, reservation, [Session("session1", "Andrii", true)]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            _service.SubmitGroupPreOrderAsync(reservation.CustomerId!, group.GroupReservationId, reservation.Id));
    }

    [Fact]
    public async Task SubmitGroupPreOrderAsync_WhenOrderIsMissing_ThrowsValidationException()
    {
        var group = OpenGroup();
        var reservation = OwnerReservation(group.ReservationId);
        SetupOwner(group, reservation, [Session("session1", "Andrii", true, ("dish1", 1))]);
        _orders.Setup(repository => repository.GetOrderByReservationIdAsync(reservation.Id))
            .ReturnsAsync((Order?)null);

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            _service.SubmitGroupPreOrderAsync(reservation.CustomerId!, group.GroupReservationId, reservation.Id));

        Assert.Equal("Order not found.", exception.Message);
    }

    [Fact]
    public async Task DeleteGuestSessionAsync_ReturnsUpdatedSnapshot()
    {
        var group = OpenGroup();
        var reservation = OwnerReservation(group.ReservationId);
        var removed = Session("session1", "Andrii", true, ("dish1", 2));
        var remaining = Session("session2", "Olena", false, ("dish2", 1));

        SetupOwner(group, reservation, [removed, remaining]);
        _guestSessions.Setup(repository => repository.GetByGuestSessionId(removed.Id)).ReturnsAsync(removed);
        _guestSessions.Setup(repository => repository.DeleteAsync(removed))
            .Callback(() =>
            {
                _guestSessions.Setup(repository => repository.GetAllByGroupReservationIdAsync(group.GroupReservationId))
                    .ReturnsAsync([remaining]);
            })
            .Returns(Task.CompletedTask);
        _dishes.Setup(repository => repository.GetDishesByIdsAsync(It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync([Dish("dish2", "Tom Yum", 220)]);

        var response = await _service.DeleteGuestSessionAsync(
            reservation.CustomerId!,
            group.GroupReservationId,
            removed.Id);

        var participants = response.Participants.ToArray();
        Assert.Single(participants);
        Assert.Equal("session2", participants[0].Id);
        Assert.Equal(220, response.Total);
    }

    [Fact]
    public async Task DeleteGuestSessionAsync_WhenSessionBelongsToAnotherGroup_ThrowsValidationException()
    {
        var group = OpenGroup();
        var reservation = OwnerReservation(group.ReservationId);
        var session = Session("session1", "Andrii", true);
        session.GroupReservationId = "other-group";

        SetupOwner(group, reservation, []);
        _guestSessions.Setup(repository => repository.GetByGuestSessionId(session.Id)).ReturnsAsync(session);

        await Assert.ThrowsAsync<ValidationException>(() =>
            _service.DeleteGuestSessionAsync(reservation.CustomerId!, group.GroupReservationId, session.Id));
    }

    private void SetupOwner(GroupReservation group, Reservation reservation, List<GuestSession> sessions)
    {
        _groups.Setup(repository => repository.GetGroupReservationByIdAsync(group.GroupReservationId)).ReturnsAsync(group);
        _reservations.Setup(repository => repository.GetReservationByIdAsync(reservation.Id)).ReturnsAsync(reservation);
        _guestSessions.Setup(repository => repository.GetAllByGroupReservationIdAsync(group.GroupReservationId))
            .ReturnsAsync(sessions);
    }

    private static GroupReservation OpenGroup(string reservationId = "reservation-123") => new()
    {
        GroupReservationId = "group-1",
        ReservationId = reservationId,
        ReservationToken = "token",
        Status = GroupReservationStatus.Open,
    };

    private static Reservation OwnerReservation(string id) => new()
    {
        Id = id,
        TableId = "table-1",
        WaiterId = "waiter-1",
        CustomerId = "owner-1",
    };

    private static GuestSession Session(string id, string name, bool isSubmitted, params (string DishId, int Quantity)[] dishes) => new()
    {
        Id = id,
        GuestName = name,
        GroupReservationId = "group-1",
        IsSubmitted = isSubmitted,
        Dishes = dishes.Select(dish => new OrderItem
        {
            DishId = dish.DishId,
            Quantity = dish.Quantity,
            State = OrderItemState.Pending,
        }).ToList(),
    };

    private static Dish Dish(string id, string name, decimal price) => new()
    {
        Id = id,
        Name = name,
        Price = price,
    };
}
