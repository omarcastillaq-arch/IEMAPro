export declare enum VitalType {
    BLOOD_PRESSURE = "BLOOD_PRESSURE",
    HEART_RATE = "HEART_RATE",
    GLUCOSE = "GLUCOSE"
}
export declare class CreateVitalDto {
    vital_type: VitalType;
    value: number;
    value2?: number;
    recorded_at?: string;
}
