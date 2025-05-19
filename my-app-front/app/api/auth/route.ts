import { NextResponse } from "next/server";

export type AuthRequest = {
  type: 'register' | 'login' | 'verify';
  username?: string;
  password?: string;
  email?: string;
  token?: string;
};

export type AuthResponse = {
  success: boolean;
  message: string;
  user?: {
    id: string;
    username: string;
    email?: string;
  };
  token?: string;
};

// Simple in-memory user store for demo purposes
// In a real app, this would be a database
const users: Record<string, any> = {};

export async function POST(request: Request) {
  try {
    const body: AuthRequest = await request.json();

    // Basic validation
    if (body.type === 'register' && (!body.username || !body.password)) {
      return NextResponse.json({
        success: false,
        message: "Username and password are required"
      }, { status: 400 });
    }
    else if (body.type === 'login' && (!body.username || !body.password)) {
      return NextResponse.json({
        success: false,
        message: "Username and password are required"
      }, { status: 400 });
    }
    else if (body.type === 'verify' && !body.token) {
      return NextResponse.json({
        success: false,
        message: "Token is required"
      }, { status: 400 });
    }
    else if (!['register', 'login', 'verify'].includes(body.type)) {
      return NextResponse.json({
        success: false,
        message: "Invalid request type"
      }, { status: 400 });
    }

    // Handle registration
    if (body.type === 'register') {
      const username = body.username!;

      // Check if username already exists
      if (users[username]) {
        return NextResponse.json({
          success: false,
          message: "Username already exists"
        }, { status: 400 });
      }

      // Create a new user
      const userId = `user-${Date.now()}`;
      users[username] = {
        id: userId,
        username: username,
        password: body.password, // In a real app, this would be hashed
        email: body.email
      };

      return NextResponse.json({
        success: true,
        message: "User registered successfully",
        user: {
          id: userId,
          username: username,
          email: body.email
        }
      });
    }
    // Handle login
    else if (body.type === 'login') {
      const username = body.username!;
      const password = body.password!;

      // Check if user exists and password matches
      const user = users[username];
      if (!user || user.password !== password) {
        return NextResponse.json({
          success: false,
          message: "Invalid username or password"
        }, { status: 401 });
      }

      // Generate a token
      const token = `token-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

      // Store the token with the user
      user.token = token;

      return NextResponse.json({
        success: true,
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        token
      });
    }
    // Handle token verification
    else if (body.type === 'verify') {
      const token = body.token!;

      // Find user with this token
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
          message: "Invalid token"
        }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
        message: "Token verified",
        user: {
          id: foundUser.id,
          username: foundUser.username,
          email: foundUser.email
        }
      });
    }

    // This should never happen due to validation above
    return NextResponse.json({
      success: false,
      message: "Invalid request type"
    }, { status: 400 });

  } catch (error) {
    console.error("Auth API error:", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
