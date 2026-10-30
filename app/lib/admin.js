import { getCurrentSession, hasRole } from "@/app/lib/session";
import { getCars, getUsers, STORAGE_KEYS, writeStorage } from "@/app/lib/storage";

function fail(error) {
  return { ok: false, error };
}

function getActiveAdmin() {
  const actor = getCurrentSession();
  if (!actor || actor.status !== "active" || !hasRole(actor, "admin")) {
    return { error: "An active administrator must manage demo accounts." };
  }
  return { actor };
}

/** Change a demo account's active/suspended state after rechecking admin rights. */
export function setDemoUserStatus(userId, nextStatus) {
  const auth = getActiveAdmin();
  if (auth.error) return fail(auth.error);
  if (!userId || !["active", "suspended"].includes(nextStatus)) {
    return fail("Choose a valid account and status.");
  }

  const users = getUsers();
  const target = users.find((user) => user.id === userId);
  if (!target) return fail("This demo account could not be found.");
  if (target.id === auth.actor.id && nextStatus === "suspended") {
    return fail("You cannot suspend the administrator account you are currently using.");
  }
  if (target.status === nextStatus) {
    return fail(`This account is already ${nextStatus}.`);
  }

  if (hasRole(target, "admin") && nextStatus === "suspended") {
    const otherActiveAdminExists = users.some((user) =>
      user.id !== target.id && user.status === "active" && hasRole(user, "admin")
    );
    if (!otherActiveAdminExists) {
      return fail("The last active administrator account cannot be suspended.");
    }
  }

  const updatedUser = {
    ...target,
    status: nextStatus,
    statusChangedAt: new Date().toISOString(),
    statusChangedBy: auth.actor.id,
  };
  const cars = getCars();
  let updatedCars = cars;
  if (nextStatus === "suspended") {
    updatedCars = cars.map((car) => car.ownerId === target.id && car.status !== "inactive"
      ? { ...car, status: "inactive", ownerSuspendedStatus: car.status, updatedAt: new Date().toISOString() }
      : car);
  } else {
    updatedCars = cars.map((car) => {
      if (car.ownerId !== target.id || !car.ownerSuspendedStatus) return car;
      const { ownerSuspendedStatus, ...rest } = car;
      return { ...rest, status: ownerSuspendedStatus, updatedAt: new Date().toISOString() };
    });
  }

  const carsChanged = updatedCars.some((car, index) => car !== cars[index]);
  if (carsChanged) {
    const carsResult = writeStorage(STORAGE_KEYS.cars, updatedCars);
    if (!carsResult.ok) return fail(carsResult.error);
  }

  const usersResult = writeStorage(
    STORAGE_KEYS.users,
    users.map((user) => user.id === target.id ? updatedUser : user)
  );
  if (!usersResult.ok) {
    if (carsChanged) writeStorage(STORAGE_KEYS.cars, cars);
    return fail(usersResult.error);
  }
  return { ok: true, user: updatedUser };
}
