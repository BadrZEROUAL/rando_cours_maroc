import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password, telephone, isMineur, parentEmail } = await request.json()
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Adresse email invalide' },
        { status: 400 }
      )
    }
    
    // Validate password
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      )
    }
    
    const supabase = await createClient()
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? 
          `${request.nextUrl.origin}/auth/callback`,
        data: { 
          telephone, 
          isMineur, 
          parentEmail: isMineur ? parentEmail : null 
        },
      },
    })
    
    if (error) {
      console.error('[v0] Signup error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Compte créé ! Vérifie ton email pour confirmer ton inscription.',
      user: data.user 
    })
  } catch (err: any) {
    console.error('[v0] Signup exception:', err)
    return NextResponse.json(
      { error: err.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
