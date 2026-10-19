// TEST FIXTURE ONLY: no SDK, sessions, backend calls or email.
export async function prepareAuthSignIn() {}
export const supabase={auth:{
  async resetPasswordForEmail() {
    const mode=document.getElementById('fixtureResponse').value
    if(mode==='network-error') throw Error('Synthetic network failure')
    return {error:mode==='api-error'?{message:'Synthetic API failure'}:null}
  },
  async signInWithPassword(){return {error:{message:'Sign-in disabled in fixture'}}}
}}
