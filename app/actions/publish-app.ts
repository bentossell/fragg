'use server'

import { customAlphabet } from 'nanoid'
import { supabase } from '@/lib/supabase'

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10)

export async function publishApp(
  appData: {
    name: string
    description?: string
    code: any
    template: string
    sandboxId?: string
  },
  isPublic: boolean = true
): Promise<{ url: string; shareId: string; error?: string }> {
  try {
    if (!supabase) {
      return { url: '', shareId: '', error: 'Supabase is not configured' }
    }
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { url: '', shareId: '', error: 'User not authenticated' }
    }
    
    // Generate a unique share ID
    const shareId = nanoid()
    
    // First, create or get the app record
    const { data: app, error: appError } = await supabase
      .from('apps')
      .insert({
        name: appData.name,
        description: appData.description,
        specification: appData.code,
        compiled_app: appData.code,
        user_id: user.id,
        status: 'ready',
        is_public: isPublic,
        version: '1.0.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (appError) {
      console.error('Error creating app:', appError)
      return { url: '', shareId: '', error: 'Failed to create app' }
    }
    
    // Store in published_apps table
    const { error: publishError } = await supabase
      .from('published_apps')
      .upsert({
        share_id: shareId,
        app_id: app.id,
        user_id: user.id,
        is_public: isPublic,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    
    if (publishError) {
      console.error('Error publishing app:', publishError)
      return { url: '', shareId: '', error: 'Failed to publish app' }
    }
    
    const url = process.env.NEXT_PUBLIC_SITE_URL
      ? `https://${process.env.NEXT_PUBLIC_SITE_URL}/app/${shareId}`
      : `/app/${shareId}`
    
    return { url, shareId }
  } catch (error) {
    console.error('Unexpected error in publishApp:', error)
    return { url: '', shareId: '', error: 'An unexpected error occurred' }
  }
}

export async function getPublishedApp(shareId: string) {
  try {
    if (!supabase) {
      return null
    }
    
    // Get published app data
    const { data: publishedApp, error } = await supabase
      .from('published_apps')
      .select(`
        *,
        apps!published_apps_app_id_fkey (
          id,
          name,
          description,
          specification,
          compiled_app,
          user_id,
          status,
          version,
          runtime_info,
          instance_id
        )
      `)
      .eq('share_id', shareId)
      .single()
    
    if (error || !publishedApp) {
      return null
    }
    
    // Increment view count if public
    if (publishedApp.is_public) {
      await supabase
        .from('published_apps')
        .update({ view_count: (publishedApp.view_count || 0) + 1 })
        .eq('share_id', shareId)
    }
    
    return publishedApp
  } catch (error) {
    console.error('Error fetching published app:', error)
    return null
  }
} 