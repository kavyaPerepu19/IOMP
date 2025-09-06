import axios from 'axios'

const API_BASE = 'http://localhost:5000'

export async function fetchTLEByName(name){
  const { data } = await axios.get(`${API_BASE}/api/tle`, { params: { name } })
  return data // { name, line1, line2 }
}

export async function fetchActiveTLEs(){
  const { data } = await axios.get(`${API_BASE}/api/active`, { responseType: 'text' })
  return data // raw text
}

export async function fetchInfo(name){
  const { data } = await axios.get(`${API_BASE}/api/info`, { params: { name } })
  return data // { title, extract, wikipedia_url, google_search_url }
}
