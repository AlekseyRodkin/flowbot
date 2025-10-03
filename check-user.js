require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkUser() {
  // Проверяем пользователя
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', 972753303);
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('User data:', JSON.stringify(data, null, 2));
  }
  
  process.exit(0);
}

checkUser();
