import { NextResponse } from "next/server";
import { createHash } from "crypto";

export type AuthRequest = {
  type: 'register' | 'login' | 'verify' | 'logout';
  username?: string;
  password?: string;
  token?: string;
};

export type AuthResponse = {
  success: boolean;
  message: string;
  errorType?: 'username' | 'password' | 'username_exists' | 'token' | 'validation' | 'server_error' | string;
  user?: {
    id: string;
    username: string;
  };
  token?: string;
};

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function POST(request: Request) {
  try {
    const body: AuthRequest = await request.json();

    // Validation
    const validTypes = ['register', 'login', 'verify', 'logout'];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json({
        success: false,
        message: "Invalid request type",
        errorType: "validation"
      }, { status: 400 });
    }

    if (['register', 'login'].includes(body.type) && (!body.username || !body.password)) {
      return NextResponse.json({
        success: false,
        message: "Username and password are required",
        errorType: "validation"
      }, { status: 400 });
    }

    if (['verify', 'logout'].includes(body.type) && !body.token) {
      return NextResponse.json({
        success: false,
        message: "Token is required",
        errorType: "validation"
      }, { status: 400 });
    }

    try {
      const { existsSync, mkdirSync, readFileSync, writeFileSync } = await import('fs');
      const { join } = await import('path');

      const usersFilePath = join(process.cwd(), 'data', 'users.json');
      const dataDir = join(process.cwd(), 'data');

      // Ensure data directory exists
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      // Load or initialize users
      let users: Record<string, { id: string; username: string; password: string; token?: string }> = {};

      if (existsSync(usersFilePath)) {
        try {
          const usersData = readFileSync(usersFilePath, 'utf8');
          users = JSON.parse(usersData);
        } catch {
          // Use default if file is corrupted
          users = getDefaultUsers();
        }
      } else {
        users = getDefaultUsers();
        writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
      }

      const saveUsers = () => {
        try {
          writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
        } catch {
          // Continue without persistence if save fails
        }
      };

      function getDefaultUsers() {
        return {
          "test": {
            id: "user-test-123",
            username: "test",
            password: hashPassword("password")
          }
        };
      }

      if (body.type === 'register') {
        const username = body.username!;

        if (users[username]) {
          return NextResponse.json({
            success: false,
            message: "Username already exists",
            errorType: "username_exists"
          }, { status: 400 });
        }

        const userId = `user-${Date.now()}`;
        users[username] = {
          id: userId,
          username: username,
          password: hashPassword(body.password!)
        };

        saveUsers();

        return NextResponse.json({
          success: true,
          message: "User registered successfully",
          user: {
            id: userId,
            username: username
          }
        });
      }
      else if (body.type === 'login') {
        const username = body.username!;
        const password = body.password!;

        const user = users[username];
        if (!user) {
          return NextResponse.json({
            success: false,
            message: "User does not exist",
            errorType: "username"
          }, { status: 401 });
        }

        if (user.password !== hashPassword(password)) {
          return NextResponse.json({
            success: false,
            message: "Password is incorrect",
            errorType: "password"
          }, { status: 401 });
        }

        const token = `token-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        user.token = token;
        saveUsers();

        return NextResponse.json({
          success: true,
          message: "Login successful",
          user: {
            id: user.id,
            username: user.username
          },
          token
        });
      }
      else if (body.type === 'verify') {
        const token = body.token!;

        let foundUser = null;
        for (const username in users) {
          if (users[username].token === token) {
            foundUser = users[username];
            break;
          }
        }

        if (!foundUser) {
          return NextResponse.json({
            success: false,
            message: "Invalid token",
            errorType: "token"
          }, { status: 401 });
        }

        return NextResponse.json({
          success: true,
          message: "Token verified",
          user: {
            id: foundUser.id,
            username: foundUser.username
          }
        });
      }
      else if (body.type === 'logout') {
        const token = body.token!;

        for (const username in users) {
          if (users[username].token === token) {
            delete users[username].token;
            break;
          }
        }

        saveUsers();

        return NextResponse.json({
          success: true,
          message: "Logout successful"
        });
      }

      return NextResponse.json({
        success: false,
        message: "Invalid request type",
        errorType: "validation"
      }, { status: 400 });
    } catch (error) {
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : "Server error",
        errorType: "server_error"
      }, { status: 500 });
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      errorType: "server_error"
    }, { status: 500 });
  }
}
