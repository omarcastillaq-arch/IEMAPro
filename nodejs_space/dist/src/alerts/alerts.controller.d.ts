import { AlertsService } from './alerts.service';
export declare class AlertsController {
    private alertsService;
    constructor(alertsService: AlertsService);
    getAlerts(enrollmentId: string, req: any, status?: string, priority?: string): Promise<{
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
    acknowledgeAlert(alertId: string, req: any): Promise<{
        id: string;
        status: string;
        acknowledged_by: string | null;
        acknowledged_at: Date | null;
    }>;
}
