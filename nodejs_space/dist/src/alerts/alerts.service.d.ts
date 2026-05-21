import { PrismaService } from '../common/prisma.service';
export declare class AlertsService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getAlertsByEnrollment(enrollmentId: string, userId: string, userRole: string, query: {
        status?: string;
        priority?: string;
    }): Promise<{
        items: {
            id: string;
            type: string;
            created_at: Date;
            status: string;
            enrollment_id: string;
            priority: string;
            message: string;
            vital_id: string | null;
            acknowledged_by: string | null;
            acknowledged_at: Date | null;
        }[];
    }>;
    acknowledgeAlert(alertId: string, userId: string): Promise<{
        id: string;
        status: string;
        acknowledged_by: string | null;
        acknowledged_at: Date | null;
    }>;
}
