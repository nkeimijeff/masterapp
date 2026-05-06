import { toast } from 'sonner';

export const sendEmail = async (to: string, subject: string, message: string) => {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to,
        subject,
        html: message
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send email');
    }

    // No toast here as it's often called silently, or the caller handles it
    return true;
  } catch (error: any) {
    console.error('Send Email Error:', error);
    toast.error("Erreur lors de l'envoi de l'email : " + error.message);
    return false;
  }
};
