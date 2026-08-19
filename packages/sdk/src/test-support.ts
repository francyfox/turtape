export async function captureRejection(
  promise: Promise<unknown>,
): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected promise to reject, but it resolved");
}
