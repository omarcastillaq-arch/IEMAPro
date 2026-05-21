import { PrismaService } from '../common/prisma.service';
import { CreateVitalDto } from './dto/create-vital.dto';
export declare class VitalsService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    createVital(userId: string, dto: CreateVitalDto): Promise<{
        vital: {
            id: string;
            enrollment_id: string;
            vital_type: string;
            value: number;
            value2: number | null;
            unit: string;
            source: string;
            is_abnormal: boolean;
            recorded_at: Date;
            created_at: Date;
        };
        alerts: any[];
    }>;
    getVitals(enrollmentId: string, userId: string, userRole: string, query: {
        type?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        items: {
            id: string;
            vital_type: string;
            value: number;
            value2: number | null;
            unit: string;
            source: string;
            is_abnormal: boolean;
            recorded_at: Date;
        }[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    private verifyEnrollmentAccess;
    private checkThresholds;
}
