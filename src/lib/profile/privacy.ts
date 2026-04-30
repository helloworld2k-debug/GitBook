type PublicSupporterProfileInput = {
  publicSupporterEnabled: boolean;
  publicDisplayName: string;
};

type ProfilePrivacyClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>;
  };
  from: (table: "profiles") => {
    update: (values: {
      public_supporter_enabled: boolean;
      public_display_name: string | null;
      updated_at: string;
    }) => {
      eq: (column: "id", value: string) => Promise<{ error: Error | null }>;
    };
  };
};

export async function updatePublicSupporterProfile(
  client: ProfilePrivacyClient,
  input: PublicSupporterProfileInput,
) {
  const { data } = await client.auth.getUser();

  if (!data.user) {
    throw new Error("Sign in is required to update supporter privacy.");
  }

  const publicDisplayName = input.publicDisplayName.trim() || null;
  const { error } = await client
    .from("profiles")
    .update({
      public_supporter_enabled: input.publicSupporterEnabled,
      public_display_name: publicDisplayName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.user.id);

  if (error) {
    throw error;
  }
}
