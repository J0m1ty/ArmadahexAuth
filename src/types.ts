export interface User {
    username: string;
    password: string;
    token: string;
    expires: number;
}

export interface AuthResponse {
    ResultCode: number;
    Message?: string;
    UserID?: string;
    Data?: {
        Token: string;
        UserID: string;
    };
}

export interface AuthQuery {
    appid?: string;
    user?: string;
    pass?: string;
    token?: string;
    version?: string;
}
