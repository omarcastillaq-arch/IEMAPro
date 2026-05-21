import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private prisma;
    private jwtService;
    private readonly logger;
    constructor(prisma: PrismaService, jwtService: JwtService);
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
    getMe(userId: string): Promise<{
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
            organization_id: string | null;
        };
    }>;
    private generateToken;
}
