import type { CityModelDistrict } from "@/features/app/city-model";

export type CityModelDeliverableStatus =
  | "PENDING_UPLOAD"
  | "CLIENT_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED";

export type CityModelDeliverableRow = {
  id: string;
  brand_id: string;
  district_key: string;
  file_id: string | null;
  status: string;
  uploaded_at: string | null;
  approved_at: string | null;
};

export type CityModelDistrictWorkspace = {
  district: CityModelDistrict;
  status: CityModelDeliverableStatus;
  signedUrl: string | null;
  fileName: string | null;
  canReview: boolean;
  uploadedAt: string | null;
  approvedAt: string | null;
};

export type CityModelAdminDistrict = {
  district: CityModelDistrict;
  status: CityModelDeliverableStatus;
  fileName: string | null;
};

export type CityModelUploadState = {
  status: "idle" | "success" | "error";
  message: string;
};
