import { NextRequest, NextResponse } from 'next/server';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const contact = formData.get('contact') as string | null;
    const fichier = formData.get('fichier') as File | null;

    if (!contact?.trim() || !fichier) {
      return NextResponse.json({ error: 'Contact et fichier sont requis.' }, { status: 400 });
    }

    if (fichier.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Le fichier ne doit pas depasser 20 Mo.' }, { status: 400 });
    }

    const buffer = Buffer.from(await fichier.arrayBuffer());
    const fichierBase64 = buffer.toString('base64');

    const webhookUrl = process.env.MAKE_WEBHOOK_FOURNISSEUR;

    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: contact.trim(),
          fichier_nom: fichier.name,
          fichier_type: fichier.type,
          fichier_taille: fichier.size,
          fichier_base64: fichierBase64,
          date: new Date().toISOString(),
          notification_email: 'contact@wag-btob.fr',
        }),
      });
    } else {
      console.log('[Fournisseur] Nouveau fichier recu:', {
        contact: contact.trim(),
        fichier: fichier.name,
        taille: `${(fichier.size / 1024).toFixed(1)} Ko`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Fournisseur] Erreur:', error);
    return NextResponse.json({ error: 'Erreur serveur. Reessayez.' }, { status: 500 });
  }
}
