import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/tools/add-chats');
}