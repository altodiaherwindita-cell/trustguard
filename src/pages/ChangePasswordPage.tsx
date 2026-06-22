import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield, Loader2, Check, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function ChangePasswordPage() {
  const { user, setUserFromToken } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Redirect if user doesn't need to change password (not on first login)
  useEffect(() => {
    if (user && !user.mustChangePassword && window.location.pathname === '/change-password') {
      // Allow manual access but show info
    }
  }, [user]);

  // Calculate password strength
  useEffect(() => {
    if (newPassword) {
      let score = 0;
      if (newPassword.length >= 8) score++;
      if (newPassword.length >= 12) score++;
      if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) score++;
      if (/[0-9]/.test(newPassword)) score++;
      if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) score++;
      setPasswordStrength(Math.min(score, 4));
    } else {
      setPasswordStrength(0);
    }
  }, [newPassword]);

  const getStrengthLabel = () => {
    switch (passwordStrength) {
      case 0: return 'Enter a password';
      case 1: return 'Weak';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Strong';
      default: return '';
    }
  };

  const getStrengthColor = () => {
    switch (passwordStrength) {
      case 1: return 'bg-red-500';
      case 2: return 'bg-orange-500';
      case 3: return 'bg-yellow-500';
      case 4: return 'bg-green-500';
      default: return 'bg-gray-200';
    }
  };

  const validatePassword = () => {
    const errors: string[] = [];
    
    if (newPassword.length < 8) {
      errors.push('At least 8 characters long');
    }
    if (!/[a-z]/.test(newPassword)) {
      errors.push('One lowercase letter');
    }
    if (!/[A-Z]/.test(newPassword)) {
      errors.push('One uppercase letter');
    }
    if (!/[0-9]/.test(newPassword)) {
      errors.push('One number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      errors.push('One special character');
    }
    
    return errors;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Validate password policy
    const validationErrors = validatePassword();
    if (validationErrors.length > 0) {
      toast.error('Password does not meet requirements:\n' + validationErrors.join('\n'));
      return;
    }

    setLoading(true);
    const result = await authApi.changePassword(currentPassword, newPassword);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success('Password changed successfully');
    
    // Update user state to clear mustChangePassword flag
    const updatedUser = { ...user, mustChangePassword: false };
    localStorage.setItem('auth_user', JSON.stringify(updatedUser));
    setUserFromToken(updatedUser);
    
    // Redirect to dashboard
    navigate('/dashboard', { replace: true });
  };

  const requirements = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'One lowercase letter', met: /[a-z]/.test(newPassword) },
    { label: 'One uppercase letter', met: /[A-Z]/.test(newPassword) },
    { label: 'One number', met: /[0-9]/.test(newPassword) },
    { label: 'One special character', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-2">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Change Password</CardTitle>
          <CardDescription>
            {user?.mustChangePassword 
              ? 'You must change your password before continuing'
              : 'Update your password'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              
              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>Password Strength:</span>
                    <span className={`font-medium ${
                      passwordStrength <= 1 ? 'text-red-500' :
                      passwordStrength === 2 ? 'text-orange-500' :
                      passwordStrength === 3 ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {getStrengthLabel()}
                    </span>
                  </div>
                  <Progress value={(passwordStrength / 4) * 100} className={`h-2 ${getStrengthColor()}`} />
                </div>
              )}

              {/* Password Requirements */}
              <div className="space-y-1 mt-3 p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium mb-2">Password Requirements:</p>
                {requirements.map((req, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    {req.met ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <X className="w-3 h-3 text-muted-foreground" />
                    )}
                    <span className={req.met ? 'text-green-600' : 'text-muted-foreground'}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading || newPassword !== confirmPassword}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
