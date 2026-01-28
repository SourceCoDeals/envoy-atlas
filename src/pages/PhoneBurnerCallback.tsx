import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { logger } from "@/lib/logger";

export default function PhoneBurnerCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Processing PhoneBurner authorization...");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      // Handle OAuth errors from PhoneBurner
      if (error) {
        setStatus("error");
        setMessage(errorDescription || `Authorization failed: ${error}`);
        setTimeout(() => navigate("/connections?error=oauth_denied"), 3000);
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setMessage("Missing authorization code or state parameter");
        setTimeout(() => navigate("/connections?error=missing_params"), 3000);
        return;
      }

      // Note: We skip client-side state validation since sessionStorage doesn't
      // persist across browser tabs/windows. The edge function validates the state
      // parameter contains valid workspace_id and user_id.

      try {
        // Get current session for authorization
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
          setStatus("error");
          setMessage("Session expired. Please sign in and try again.");
          setTimeout(() => navigate("/auth"), 3000);
          return;
        }

        // Exchange the code for tokens
        const res = await supabase.functions.invoke("phoneburner-oauth", {
          body: {
            action: "callback",
            code,
            state,
          },
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        });

        if (res.error) {
          throw new Error(res.error.message || "Failed to exchange authorization code");
        }

        if (res.data?.success) {
          setStatus("success");
          setMessage("PhoneBurner connected successfully!");
          setTimeout(() => navigate("/connections?success=phoneburner_connected"), 2000);
        } else {
          throw new Error(res.data?.error || "Failed to complete authorization");
        }
      } catch (e: any) {
        logger.error("OAuth callback error", e);
        setStatus("error");
        setMessage(e?.message || "Failed to complete PhoneBurner authorization");
        setTimeout(() => navigate("/connections?error=callback_failed"), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === "processing" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h1 className="text-xl font-semibold">Connecting PhoneBurner</h1>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-semibold text-green-600">Connected!</h1>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold text-destructive">Connection Failed</h1>
          </>
        )}
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
