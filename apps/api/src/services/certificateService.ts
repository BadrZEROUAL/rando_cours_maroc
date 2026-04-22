import PDFDocument from 'pdfkit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { BadgeData, Matiere, NiveauDifficulte } from '@randocours/shared';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'me-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET_CERTIFICATIONS || 'randocours-certifications';
const APP_URL = process.env.APP_URL || 'https://randocours.ma';

// ── genererCertificat ─────────────────────────────────────────
export async function genererCertificat(data: BadgeData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const etoiles = '★'.repeat(data.niveau) + '☆'.repeat(5 - data.niveau);
    const scorePct = Math.round((data.score / data.scoreMax) * 100);

    // ── En-tête fond bleu marine ──────────────────────────────
    doc.rect(0, 0, doc.page.width, 160).fill('#1A2B4A');

    doc.fillColor('#FFFFFF')
       .fontSize(28).font('Helvetica-Bold')
       .text('RandoCours Maroc', 60, 35, { align: 'center' });

    doc.fontSize(13).font('Helvetica')
       .text('Certificat de Compétences', 60, 75, { align: 'center' });

    doc.fontSize(10).fillColor('#93C5FD')
       .text('Escape Game éducatif · Intelligence Artificielle & Pédagogie', 60, 100, { align: 'center' });

    // ── Corps du certificat ───────────────────────────────────
    doc.fillColor('#1A2B4A').fontSize(11).font('Helvetica')
       .text('Certifie que :', 60, 185);

    doc.fontSize(22).font('Helvetica-Bold').fillColor('#1A2B4A')
       .text('Candidat RandoCours', 60, 205, { align: 'center' });

    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica').fillColor('#64748B')
       .text('a complété avec succès l\'Escape Game éducatif', { align: 'center' });

    // ── Niveau et matière ─────────────────────────────────────
    doc.rect(100, 265, doc.page.width - 200, 60).fill('#EFF6FF').stroke('#2563EB');

    doc.fillColor('#1A2B4A').fontSize(16).font('Helvetica-Bold')
       .text(`${etoiles}  Niveau ${data.niveau}/5`, 100, 278, {
         width: doc.page.width - 200, align: 'center'
       });

    doc.fillColor('#2563EB').fontSize(12).font('Helvetica')
       .text(data.matiere, 100, 300, { width: doc.page.width - 200, align: 'center' });

    // ── Score ─────────────────────────────────────────────────
    doc.moveDown(2);
    doc.fillColor('#1A2B4A').fontSize(11)
       .text(`Score obtenu : ${data.score} / ${data.scoreMax} points (${scorePct}%)`, {
         align: 'center'
       });

    // ── Compétences validées ──────────────────────────────────
    doc.moveDown(1.5);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1A2B4A')
       .text('Compétences démontrées :', 60);

    doc.font('Helvetica').fontSize(10).fillColor('#374151');
    const competenceLabels: Record<string, string> = {
      'pensee_critique': '✓  Pensée critique — Discrimination active entre réponses proches',
      'debat': '✓  Capacité à débattre — Argumentation et défense d\'une position',
      'creativite': '✓  Créativité profonde — Transfert de connaissances et innovation',
      'cooperation': '✓  Coopération — Intelligence collective et responsabilité partagée',
      'meta_apprentissage': '✓  Méta-apprentissage — Réflexivité sur son propre raisonnement',
    };

    for (const comp of data.competencesValidees) {
      doc.text(competenceLabels[comp] || `✓  ${comp}`, 80, undefined, { lineGap: 4 });
    }

    // ── Date et signature ─────────────────────────────────────
    doc.moveDown(2);
    doc.fontSize(10).fillColor('#64748B')
       .text(`Délivré le ${new Date(data.issuedOn).toLocaleDateString('fr-MA', {
         year: 'numeric', month: 'long', day: 'numeric'
       })}`, { align: 'center' });

    // ── QR Code de vérification ───────────────────────────────
    try {
      const qrBuffer = await QRCode.toBuffer(data.verifyUrl, {
        width: 80, margin: 1, color: { dark: '#1A2B4A', light: '#FFFFFF' }
      });

      doc.image(qrBuffer,
        doc.page.width - 120, doc.page.height - 130,
        { width: 70, height: 70 }
      );

      doc.fontSize(7).fillColor('#64748B')
         .text('Vérifier ce badge', doc.page.width - 125, doc.page.height - 58, { width: 80, align: 'center' });
    } catch { /* QR optionnel */ }

    // ── Footer ────────────────────────────────────────────────
    doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill('#1A2B4A');
    doc.fillColor('#93C5FD').fontSize(8)
       .text(`ID Badge : ${data.id} · randocours.ma · Loi 09-08 CNDP Maroc`,
         60, doc.page.height - 27, { align: 'center' });

    doc.end();
  });
}

// ── genererOpenBadgeJSON ──────────────────────────────────────
export function genererOpenBadgeJSON(data: BadgeData, email: string): object {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedEmail = 'sha256$' + crypto.createHash('sha256')
    .update(email + salt)
    .digest('hex');

  return {
    '@context': 'https://w3id.org/openbadges/v2',
    type: 'Assertion',
    id: `${APP_URL}/api/v1/badges/verify/${data.id}`,
    badge: {
      type: 'BadgeClass',
      id: `${APP_URL}/badges/classes/niveau-${data.niveau}-${data.matiere.toLowerCase()}`,
      name: `RandoCours — Niveau ${data.niveau} ${data.matiere}`,
      description: `Badge de compétences validant la maîtrise du niveau ${data.niveau}/5 en ${data.matiere} via l'Escape Game RandoCours Maroc.`,
      image: `${APP_URL}/badges/images/niveau-${data.niveau}.png`,
      criteria: { narrative: `Compléter l'Escape Game RandoCours au niveau ${data.niveau}/5, valider les 5 tâches devant jury, et obtenir un score ≥ ${Math.round(data.scoreMax * 0.6)} points.` },
      issuer: {
        type: 'Profile',
        id: `${APP_URL}/issuer`,
        name: 'RandoCours Maroc',
        url: APP_URL,
        email: 'badges@randocours.ma',
      },
    },
    recipient: {
      type: 'email',
      hashed: true,
      salt,
      identity: hashedEmail,
    },
    issuedOn: data.issuedOn,
    expires: new Date(
      new Date(data.issuedOn).getFullYear() + 2 + '-' +
      new Date(data.issuedOn).toISOString().slice(5)
    ).toISOString(),
    verification: { type: 'HostedBadge' },
    evidence: [{ type: 'Evidence', narrative: `Score : ${data.score}/${data.scoreMax} · Compétences : ${data.competencesValidees.join(', ')}` }],
  };
}

// ── uploadCertificat ──────────────────────────────────────────
export async function uploadCertificat(
  buffer: Buffer,
  badgeId: string
): Promise<string> {
  const key = `certifications/${badgeId}.pdf`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'application/pdf',
    CacheControl: 'max-age=31536000',
    Metadata: { badgeId, generatedAt: new Date().toISOString() },
  }));

  return `https://${BUCKET}.s3.${process.env.AWS_REGION || 'me-south-1'}.amazonaws.com/${key}`;
}

// ── uploadBadgeJSON ───────────────────────────────────────────
export async function uploadBadgeJSON(
  badgeJson: object,
  badgeId: string
): Promise<string> {
  const key = `badges/${badgeId}.json`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(badgeJson, null, 2),
    ContentType: 'application/json',
    CacheControl: 'max-age=31536000',
  }));

  return `https://${BUCKET}.s3.${process.env.AWS_REGION || 'me-south-1'}.amazonaws.com/${key}`;
}
