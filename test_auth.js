import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yzrseugqsbztmflmwmuf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6cnNldWdxc2J6dG1mbG13bXVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNjcwOTQsImV4cCI6MjEwNTY0MzA5NH0.FZiGIl4immOql4kvDmrn3GxWlvMcw6vHXT036WsUlBw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuth() {
  console.log('Testing Admin login...');
  const { data: adminData, error: adminErr } = await supabase.auth.signInWithPassword({
    email: 'uk911574@gmail.com',
    password: '1221'
  });
  if (adminErr) {
    console.error('Admin login error:', adminErr);
  } else {
    console.log('Admin login SUCCESS:', adminData.user.email, 'User ID:', adminData.user.id);
  }

  await supabase.auth.signOut();

  console.log('Testing Staff login...');
  const { data: staffData, error: staffErr } = await supabase.auth.signInWithPassword({
    email: 'mani911574@gmail.com',
    password: '9090'
  });
  if (staffErr) {
    console.error('Staff login error:', staffErr);
  } else {
    console.log('Staff login SUCCESS:', staffData.user.email, 'User ID:', staffData.user.id);
  }
}

testAuth();
