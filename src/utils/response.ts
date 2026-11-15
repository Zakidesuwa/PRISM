// src/utils/response.ts

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

export function actionSuccess<T>(data: T, message?: string): ActionResponse<T> {
  return {
    success: true,
    data,
    ...(message ? { message } : {}),
  };
}

export function actionError<T = unknown>(error: string, code?: string): ActionResponse<T> {
  return {
    success: false,
    error,
    ...(code ? { code } : {}),
  };
}
