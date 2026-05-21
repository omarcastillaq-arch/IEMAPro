import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    signup(dto: SignupDto): Promise<{
        token: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
            organization_id: string | null;
        };
    }>;
    login(dto: LoginDto): Promise<{
        token: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
            organization_id: string | null;
        };
    }>;
    getMe(req: any): Promise<{
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
            organization_id: string | null;
        };
    }>;
}
