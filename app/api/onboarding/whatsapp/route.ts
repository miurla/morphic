import { NextResponse } from 'next/server'

const WASENDER_API_KEY = process.env.WASENDER_API_KEY!

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, phoneNumber } = body

    if (action === 'test') {
      if (!phoneNumber) {
        return NextResponse.json(
          { error: 'Numéro de téléphone requis' },
          { status: 400 }
        )
      }

      const cleanNumber = phoneNumber.replace(/[^0-9]/g, '')

      const res = await fetch(
        'https://www.wasenderapi.com/api/send-message',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${WASENDER_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: cleanNumber,
            text: '👋 Nice to meet you ! Ton compte Melron est connecté. Tu recevras ici tes alertes et résultats de recherche.\n\n— Melron'
          })
        }
      )

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json(
          {
            error:
              err.message || "Échec de l'envoi. Vérifie ton numéro."
          },
          { status: 400 }
        )
      }

      const data = await res.json()
      return NextResponse.json({ status: 'sent', data })
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  } catch (error) {
    console.error('[onboarding/whatsapp] Error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
