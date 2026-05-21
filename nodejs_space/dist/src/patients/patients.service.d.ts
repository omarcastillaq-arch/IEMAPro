import { PrismaService } from '../common/prisma.service';
export declare class PatientsService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getProfile(userId: string): Promise<{
        id: string;
        user_id: string;
        name: string;
        email: string;
        date_of_birth: Date | null;
        gender: string | null;
        blood_type: string | null;
        height_cm: number | null;
        weight_kg: number | null;
        emergency_contact_name: string | null;
        emergency_contact_phone: string | null;
        allergies: string[];
        medications: string[];
        conditions: string[];
        insurance_provider: string | null;
        insurance_number: string | null;
        notes: string | null;
    }>;
    getDashboard(userId: string): Promise<{
        enrollment: {
            id: string;
            status: string;
            diagnosis: string | null;
            enrolled_at: Date;
        };
        lastVitals: Record<string, any>;
        recentVitals: {
            id: string;
            vital_type: string;
            value: number;
            value2: number | null;
            unit: string;
            is_abnormal: boolean;
            recorded_at: Date;
        }[];
        recentAlerts: {
            id: string;
            type: string;
            created_at: Date;
            status: string;
            priority: string;
            message: string;
        }[];
    }>;
}
