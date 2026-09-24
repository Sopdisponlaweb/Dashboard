import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string; documentId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id, documentId } = await params;
  const supabase = await createClient();

  // The directory view resolves the titular of beneficiary files too.
  const { data: document, error } = await supabase
    .from("member_document_directory")
    .select("storage_path")
    .eq("id", documentId)
    .eq("affiliate_id", id)
    .maybeSingle();

  if (error || !document) {
    return NextResponse.json({ message: "Documento no encontrado o sin permiso para consultarlo." }, { status: 404 });
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from("affiliate-files")
    .createSignedUrl(document.storage_path, 60);

  if (signedError || !signed) {
    return NextResponse.json({ message: "No fue posible generar el enlace de descarga." }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
