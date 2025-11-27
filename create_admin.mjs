import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const lines = envContent.split('\n');

let supabaseUrl = '';
let supabaseKey = '';

lines.forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
    supabaseKey = line.split('=')[1].trim();
  }
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: 'admin@university.edu',
      password: 'Admin123!',
    });

    if (error) {
      console.error('Error creating admin user:', error.message);
      return;
    }

    if (data.user) {
      console.log('Admin user created successfully!');
      console.log('User ID:', data.user.id);
      
      const { error: adminError } = await supabase
        .from('admin_users')
        .insert({
          id: data.user.id,
          email: 'admin@university.edu',
          name: 'Administrator',
          role: 'admin',
        });

      if (adminError) {
        console.error('Error creating admin record:', adminError.message);
      } else {
        console.log('Admin record created successfully!');
        console.log('\n=================================');
        console.log('ADMIN CREDENTIALS');
        console.log('=================================');
        console.log('Email: admin@university.edu');
        console.log('Password: Admin123!');
        console.log('=================================');
      }
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

createAdmin();
