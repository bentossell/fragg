'use server'

import { supabase } from '@/lib/supabase'
import { getPublishedApp } from './publish-app'

export async function forkApp(shareId: string, userId?: string) {
  if (!supabase) {
    return { success: false, error: 'Supabase is not configured' }
  }
  
  try {
    // Get the published app
    const publishedApp = await getPublishedApp(shareId)
    
    if (!publishedApp || !publishedApp.apps) {
      return { success: false, error: 'App not found' }
    }
    
    const originalApp = publishedApp.apps
    
    // If no userId provided, we'll create a temporary fork in session storage
    if (!userId) {
      return {
        success: true,
        appData: {
          name: `${originalApp.name} (Fork)`,
          description: originalApp.description,
          code: originalApp.specification || originalApp.compiled_app,
          template: 'nextjs-developer', // Default template
          isForked: true,
          originalShareId: shareId
        }
      }
    }
    
    // Create a forked copy for the user
    const { data: forkedApp, error } = await supabase
      .from('apps')
      .insert({
        user_id: userId,
        name: `${originalApp.name} (Fork)`,
        description: originalApp.description,
        specification: originalApp.specification,
        compiled_app: originalApp.compiled_app,
        ui_components: originalApp.ui_components,
        status: 'ready',
        is_public: false,
        version: '1.0.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error forking app:', error)
      return { success: false, error: 'Failed to fork app' }
    }
    
    // Create initial version for the forked app
    if (forkedApp) {
      await supabase
        .from('app_versions')
        .insert({
          app_id: forkedApp.id,
          version: 1,
          code: originalApp.specification || originalApp.compiled_app,
          message: `Forked from ${originalApp.name}`,
          created_by: userId,
          created_at: new Date().toISOString()
        })
    }
    
    return {
      success: true,
      appData: {
        id: forkedApp.id,
        name: forkedApp.name,
        description: forkedApp.description,
        code: forkedApp.specification || forkedApp.compiled_app,
        template: 'nextjs-developer',
        isForked: true,
        originalShareId: shareId
      }
    }
  } catch (error) {
    console.error('Unexpected error in forkApp:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
} 