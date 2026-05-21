import { DoctorService } from './doctor.service';
export declare class DoctorController {
    private doctorService;
    constructor(doctorService: DoctorService);
    getDashboard(req: any): Promise<{
        stats: {
            activePatients: number;
            criticalAlerts: number;
            pendingAlerts: number;
        };
        recentVitals: {
            id: any;
            vital_type: any;
            value: any;
            value2: any;
            unit: any;
            is_abnormal: any;
            recorded_at: any;
            enrollment_id: any;
            patient_name: any;
        }[];
        recentAlerts: {
            id: any;
            type: any;
            priority: any;
            status: any;
            message: any;
            created_at: any;
            enrollment_id: any;
            patient_name: any;
        }[];
    }>;
    getPatients(req: any): Promise<{
        patients: {
            enrollment_id: any;
            patient_id: any;
            patient_name: any;
            status: any;
            diagnosis: any;
            monitoring_type: any;
            enrolled_at: any;
            last_data_received_at: any;
        }[];
    }>;
    getPatientDetail(enrollmentId: string, req: any): Promise<{
        enrollment: {
            id: string;
            patient_id: string;
            patient_name: string | null;
            status: string;
            monitoring_type: string;
            diagnosis: string | null;
            notes: string | null;
            enrolled_at: Date;
            last_data_received_at: Date | null;
            thresholds: {
                hr_high: number;
                hr_low: number;
                bp_sys_high: number;
                bp_dia_high: number;
                glucose_high: number;
                glucose_low: number;
            };
        };
        recentVitals: {
            id: string;
            vital_type: string;
            value: number;
            value2: number | null;
            unit: string;
            is_abnormal: boolean;
            recorded_at: Date;
        }[];
        activeAlerts: {
            id: string;
            type: string;
            created_at: Date;
            status: string;
            priority: string;
            message: string;
            vital_id: string | null;
        }[];
    }>;
    getAlerts(req: any, priority?: string, status?: string): Promise<{
        items: {
            id: any;
            enrollment_id: any;
            type: any;
            priority: any;
            status: any;
            message: any;
            patient_name: any;
            created_at: any;
        }[];
    }>;
}
