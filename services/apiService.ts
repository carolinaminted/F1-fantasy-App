import { auth } from './firebase.ts';
import type { EventResult } from '../types.ts';

interface ApiErrorBody {
    error?: {
        code?: string;
        message?: string;
    };
}

class ApiRequestError extends Error {
    code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = 'ApiRequestError';
        this.code = code;
    }
}

const apiRequest = async <T>(
    apiBaseUrl: string,
    path: string,
    options: { method: 'POST' | 'PUT' | 'DELETE'; body?: unknown; idToken?: string },
): Promise<T> => {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}${path}`, {
        method: options.method,
        headers: {
            ...(options.idToken ? { Authorization: `Bearer ${options.idToken}` } : {}),
            'Content-Type': 'application/json',
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });

    const body = await response.json().catch(() => ({})) as ApiErrorBody & T;
    if (!response.ok) {
        throw new ApiRequestError(
            body.error?.code || 'api_error',
            body.error?.message || `API request failed (${response.status}).`,
        );
    }
    return body;
};

const authenticatedApiRequest = async <T>(
    apiBaseUrl: string,
    path: string,
    options: { method: 'POST' | 'PUT' | 'DELETE'; body?: unknown },
): Promise<T> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Login required.');

    const idToken = await currentUser.getIdToken();
    return apiRequest<T>(apiBaseUrl, path, { ...options, idToken });
};

export const validateApiInvitationCode = async (apiBaseUrl: string, code: string) => (
    apiRequest<{ valid: boolean }>(apiBaseUrl, '/v1/auth/invitations/validate', {
        method: 'POST',
        body: { code },
    })
);

export const sendApiEmailCode = async (apiBaseUrl: string, email: string) => (
    apiRequest<{ success: boolean }>(apiBaseUrl, '/v1/auth/email-code/send', {
        method: 'POST',
        body: { email },
    })
);

export const verifyApiEmailCode = async (
    apiBaseUrl: string,
    email: string,
    code: string,
) => apiRequest<{ valid: boolean; message?: string }>(apiBaseUrl, '/v1/auth/email-code/verify', {
    method: 'POST',
    body: { email, code },
});

export const sendApiPasswordReset = async (apiBaseUrl: string, email: string) => (
    apiRequest<{ success: boolean }>(apiBaseUrl, '/v1/auth/password-reset', {
        method: 'POST',
        body: { email },
    })
);

export const triggerApiLeaderboardSync = async (apiBaseUrl: string) => {
    const body = await authenticatedApiRequest<{
        success?: boolean;
        usersProcessed?: number;
    }>(apiBaseUrl, '/v1/admin/leaderboard/recalculate', { method: 'POST', body: {} });
    if (body.success !== true || typeof body.usersProcessed !== 'number') {
        throw new Error('Sync service returned an invalid response.');
    }

    return { success: true, usersProcessed: body.usersProcessed };
};

export const saveApiRaceResults = async (
    apiBaseUrl: string,
    eventId: string,
    results: EventResult,
) => authenticatedApiRequest<{ success: true; eventId: string; usersProcessed: number }>(
    apiBaseUrl,
    `/v1/admin/events/${encodeURIComponent(eventId)}/results`,
    { method: 'PUT', body: { results } },
);

export const cancelApiEvent = async (
    apiBaseUrl: string,
    eventId: string,
    reason?: string,
) => authenticatedApiRequest<{ success: true; eventId: string; usersProcessed: number }>(
    apiBaseUrl,
    `/v1/admin/events/${encodeURIComponent(eventId)}/cancellation`,
    { method: 'PUT', body: { reason: reason || null } },
);

export const restoreApiEvent = async (apiBaseUrl: string, eventId: string) => (
    authenticatedApiRequest<{ success: true; eventId: string; usersProcessed: number }>(
        apiBaseUrl,
        `/v1/admin/events/${encodeURIComponent(eventId)}/cancellation`,
        { method: 'DELETE' },
    )
);
