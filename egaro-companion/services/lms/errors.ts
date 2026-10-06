// Three kinds of failure, because the app reacts differently to each:
//  - LmsAuthError:      e-GURO rejected the login. Stop retrying and ask the student to reconnect.
//  - LmsTemporaryError: network problem, timeout or server error. Try again later.
//  - LmsFormatError:    e-GURO answered, but not in the shape we expect (the site probably changed).
// None of these messages may contain passwords, cookies or page contents.
export class LmsAuthError extends Error {
  readonly code = "AUTH_FAILED";
}
export class LmsTemporaryError extends Error {
  readonly code = "TEMPORARY";
}
export class LmsFormatError extends Error {
  readonly code = "FORMAT_CHANGED";
}
