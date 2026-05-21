import { VitalsService } from './vitals.service';
import { CreateVitalDto } from './dto/create-vital.dto';
export declare class VitalsController {
    private vitalsService;
    constructor(vitalsService: VitalsService);
    createVital(req: any, dto: CreateVitalDto): Promise<{
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
    getVitals(enrollmentId: string, req: any, type?: string, page?: string, limit?: string): Promise<{
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
}
