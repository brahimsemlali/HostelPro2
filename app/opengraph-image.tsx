import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Sweet Reservation — Logiciel de Gestion d\'Hostel au Maroc'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0A1F1C 0%, #0F3D2E 50%, #0F6E56 100%)',
          padding: '72px 80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top — logo area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #21C77A, #0F6E56)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: 26, color: '#fff' }}>🏨</div>
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.02em' }}>
            Sweet Reservation
          </span>
        </div>

        {/* Middle — headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#21C77A',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Logiciel de gestion · Maroc
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.05,
              letterSpacing: '-0.035em',
            }}
          >
            Gérez votre hostel.
            <span style={{ color: '#21C77A', display: 'block' }}>Sans papier.</span>
          </div>
          <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, maxWidth: 620 }}>
            Check-in digital · Fiches de police · WhatsApp · Paiements MAD
          </div>
        </div>

        {/* Bottom row — feature pills */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {['✓ Check-in en 60s', '✓ Fiche de police PDF', '✓ WhatsApp intégré', '✓ Rapports en MAD'].map((f) => (
            <div
              key={f}
              style={{
                padding: '10px 20px',
                borderRadius: 100,
                background: 'rgba(33,199,122,0.15)',
                border: '1px solid rgba(33,199,122,0.3)',
                color: '#21C77A',
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
