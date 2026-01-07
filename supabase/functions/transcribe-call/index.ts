import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { call_id, workspace_id, recording_url } = await req.json();

    if (!call_id || !workspace_id) {
      throw new Error("call_id and workspace_id are required");
    }

    console.log(`[transcribe-call] Starting transcription for call ${call_id}`);

    // Check if transcript already exists
    const { data: existingTranscript } = await supabase
      .from("call_transcripts")
      .select("id, transcription_status")
      .eq("call_id", call_id)
      .single();

    if (existingTranscript?.transcription_status === "completed") {
      console.log(`[transcribe-call] Transcript already exists for call ${call_id}`);
      return new Response(
        JSON.stringify({ success: true, transcript_id: existingTranscript.id, status: "already_exists" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get call details if recording_url not provided
    let audioUrl = recording_url;
    if (!audioUrl) {
      const { data: call, error: callError } = await supabase
        .from("phoneburner_calls")
        .select("recording_url, duration_seconds")
        .eq("id", call_id)
        .single();

      if (callError || !call) {
        throw new Error(`Call not found: ${call_id}`);
      }

      audioUrl = call.recording_url;
    }

    if (!audioUrl) {
      throw new Error("No recording URL available for this call");
    }

    // Create or update transcript record as processing
    let transcriptId: string;
    if (existingTranscript) {
      transcriptId = existingTranscript.id;
      await supabase
        .from("call_transcripts")
        .update({ transcription_status: "processing", transcription_error: null })
        .eq("id", transcriptId);
    } else {
      const { data: newTranscript, error: insertError } = await supabase
        .from("call_transcripts")
        .insert({
          call_id,
          workspace_id,
          transcription_status: "processing",
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      transcriptId = newTranscript.id;
    }

    console.log(`[transcribe-call] Fetching audio from: ${audioUrl}`);

    // Fetch the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
    
    // Determine audio MIME type from URL or default
    let mimeType = "audio/mpeg";
    if (audioUrl.includes(".wav")) mimeType = "audio/wav";
    else if (audioUrl.includes(".ogg")) mimeType = "audio/ogg";
    else if (audioUrl.includes(".m4a")) mimeType = "audio/mp4";

    console.log(`[transcribe-call] Audio fetched, size: ${audioBuffer.byteLength} bytes, type: ${mimeType}`);

    // Use Lovable AI (Gemini) for transcription
    const transcriptionPrompt = `You are a transcription assistant. Please transcribe the following audio recording of a cold call between a sales representative and a business owner.

Instructions:
1. Transcribe the entire conversation word-for-word
2. Identify speakers as "Rep:" and "Prospect:" based on context
3. Include timestamps at the start of each speaker turn if possible (estimate based on conversation flow)
4. Capture all speech including filler words, interruptions, and overlapping speech
5. Note any significant pauses or non-verbal sounds in [brackets]

Format the output as a clean transcript with speaker labels on each line.`;

    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: transcriptionPrompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${audioBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 16000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`[transcribe-call] AI API error: ${errorText}`);
      throw new Error(`AI transcription failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const transcriptText = aiResult.choices?.[0]?.message?.content || "";

    if (!transcriptText) {
      throw new Error("AI returned empty transcript");
    }

    console.log(`[transcribe-call] Transcription completed, length: ${transcriptText.length} chars`);

    // Parse transcript into speaker segments
    const speakerSegments: Array<{ speaker: string; text: string; line_number: number }> = [];
    const lines = transcriptText.split("\n").filter((l: string) => l.trim());
    
    lines.forEach((line: string, index: number) => {
      const repMatch = line.match(/^Rep:?\s*(.+)/i);
      const prospectMatch = line.match(/^Prospect:?\s*(.+)/i);
      
      if (repMatch) {
        speakerSegments.push({ speaker: "Rep", text: repMatch[1].trim(), line_number: index });
      } else if (prospectMatch) {
        speakerSegments.push({ speaker: "Prospect", text: prospectMatch[1].trim(), line_number: index });
      } else if (line.trim() && speakerSegments.length > 0) {
        // Continuation of previous speaker
        speakerSegments[speakerSegments.length - 1].text += " " + line.trim();
      }
    });

    // Calculate word count
    const wordCount = transcriptText.split(/\s+/).filter((w: string) => w).length;

    // Update transcript record
    const { error: updateError } = await supabase
      .from("call_transcripts")
      .update({
        transcript_text: transcriptText,
        speaker_segments: speakerSegments,
        transcription_status: "completed",
        word_count: wordCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", transcriptId);

    if (updateError) throw updateError;

    console.log(`[transcribe-call] Transcript saved successfully for call ${call_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        transcript_id: transcriptId,
        word_count: wordCount,
        segments_count: speakerSegments.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[transcribe-call] Error:", errorMessage);

    // Try to update transcript status to failed
    try {
      const { call_id } = await req.clone().json();
      if (call_id) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase
          .from("call_transcripts")
          .update({
            transcription_status: "failed",
            transcription_error: errorMessage,
          })
          .eq("call_id", call_id);
      }
    } catch (e) {
      console.error("[transcribe-call] Failed to update error status:", e);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
