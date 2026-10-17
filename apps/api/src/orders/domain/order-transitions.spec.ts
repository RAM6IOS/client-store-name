import { OrderStatus, ShipmentStatus } from "../../generated/prisma/client"
import { canTransition, releasesReservations, shipmentStatusFor } from "./order-transitions"

describe("canTransition", () => {
  it("accepts the documented COD path", () => {
    expect(canTransition(OrderStatus.pending_confirmation, OrderStatus.confirmed)).toBe(true)
    expect(canTransition(OrderStatus.confirmed, OrderStatus.preparing)).toBe(true)
    expect(canTransition(OrderStatus.preparing, OrderStatus.dispatched)).toBe(true)
    expect(canTransition(OrderStatus.dispatched, OrderStatus.shipped)).toBe(true)
    expect(canTransition(OrderStatus.shipped, OrderStatus.delivered)).toBe(true)
  })

  it("accepts the contact-failure outcomes from the confirmation stage", () => {
    expect(canTransition(OrderStatus.pending_confirmation, OrderStatus.no_answer)).toBe(true)
    expect(canTransition(OrderStatus.pending_confirmation, OrderStatus.wrong_number)).toBe(true)
    expect(canTransition(OrderStatus.no_answer, OrderStatus.confirmed)).toBe(true)
    expect(canTransition(OrderStatus.wrong_number, OrderStatus.cancelled)).toBe(true)
  })

  it("rejects skipping steps and transitions out of terminal states", () => {
    expect(canTransition(OrderStatus.pending_confirmation, OrderStatus.shipped)).toBe(false)
    expect(canTransition(OrderStatus.preparing, OrderStatus.shipped)).toBe(false)
    expect(canTransition(OrderStatus.cancelled, OrderStatus.confirmed)).toBe(false)
    expect(canTransition(OrderStatus.returned, OrderStatus.preparing)).toBe(false)
  })
})

describe("shipmentStatusFor", () => {
  it("leaves the shipment untouched before dispatch", () => {
    expect(shipmentStatusFor(OrderStatus.confirmed)).toBeNull()
    expect(shipmentStatusFor(OrderStatus.preparing)).toBeNull()
    expect(shipmentStatusFor(OrderStatus.cancelled)).toBeNull()
  })

  it("mirrors dispatch, delivery, failure and return", () => {
    expect(shipmentStatusFor(OrderStatus.dispatched)).toBe(ShipmentStatus.shipped)
    expect(shipmentStatusFor(OrderStatus.shipped)).toBe(ShipmentStatus.shipped)
    expect(shipmentStatusFor(OrderStatus.delivered)).toBe(ShipmentStatus.delivered)
    expect(shipmentStatusFor(OrderStatus.delivery_failed)).toBe(ShipmentStatus.failed)
    expect(shipmentStatusFor(OrderStatus.returned)).toBe(ShipmentStatus.returned)
  })
})

describe("releasesReservations", () => {
  it("frees stock on cancellation and return only", () => {
    expect(releasesReservations(OrderStatus.cancelled)).toBe(true)
    expect(releasesReservations(OrderStatus.returned)).toBe(true)
    expect(releasesReservations(OrderStatus.delivery_failed)).toBe(false)
    expect(releasesReservations(OrderStatus.delivered)).toBe(false)
  })
})
