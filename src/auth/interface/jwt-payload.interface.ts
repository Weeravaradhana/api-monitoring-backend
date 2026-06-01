export interface JwtPayload {
  exp: number;
  email?: string;
  sub?: string;
}
