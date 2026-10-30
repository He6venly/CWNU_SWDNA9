import type { ErrorCode } from '../../../contract/types.ts'

export class HttpError extends Error {
  readonly status: number
  readonly code: ErrorCode
  constructor(status: number, code: ErrorCode, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}
export const invalidRequest = () => new HttpError(400, 'INVALID_REQUEST', '요청 형식을 확인해 주세요.')
export const payloadTooLarge = () => new HttpError(413, 'PAYLOAD_TOO_LARGE', '요청 또는 이미지 크기가 제한을 초과했습니다.')
export const unavailable = () => new HttpError(503, 'SERVICE_UNAVAILABLE', '실제 AI 연결은 아직 활성화되지 않았습니다.')
