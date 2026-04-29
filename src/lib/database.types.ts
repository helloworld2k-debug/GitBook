export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: { Row: { id: string; email: string; is_admin: boolean } };
      donations: { Row: { id: string; user_id: string; amount: number; currency: string; status: string } };
      certificates: { Row: { id: string; certificate_number: string; user_id: string; type: "donation" | "honor"; status: string } };
    };
  };
};
