import { motion } from 'framer-motion';
import { StatCard } from '@/components/ui/StatCard';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { mockVendors, mockDashboardStats, mockAssessments } from '@/data/mockData';
import {
  Building2,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Bot,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function Dashboard() {
  const recentVendors = mockVendors.slice(0, 5);
  const pendingAssessments = mockAssessments.filter(a => a.status !== 'reviewed');

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage your third-party risk assessments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/ai-assistant">
            <Button variant="outline" className="gap-2">
              <Bot className="w-4 h-4" />
              AI Assistant
            </Button>
          </Link>
          <Link to="/vendors">
            <Button className="gap-2 bg-gradient-primary hover:opacity-90">
              <Building2 className="w-4 h-4" />
              Add Vendor
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={item}>
          <StatCard
            title="Total Vendors"
            value={mockDashboardStats.totalVendors}
            subtitle="Active third parties"
            icon={Building2}
            trend={{ value: 12, isPositive: true }}
            variant="primary"
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard
            title="Pending Assessments"
            value={mockDashboardStats.pendingAssessments}
            subtitle="Awaiting review"
            icon={ClipboardList}
            variant="accent"
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard
            title="High Risk Vendors"
            value={mockDashboardStats.highRiskVendors}
            subtitle="Require attention"
            icon={AlertTriangle}
            variant="warning"
          />
        </motion.div>
        <motion.div variants={item}>
          <StatCard
            title="Completed This Month"
            value={mockDashboardStats.completedThisMonth}
            subtitle="Assessments reviewed"
            icon={CheckCircle2}
            trend={{ value: 8, isPositive: true }}
            variant="success"
          />
        </motion.div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Risk Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                Risk Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Low Risk</span>
                    <span className="font-medium text-success">45%</span>
                  </div>
                  <Progress value={45} className="h-2 bg-muted [&>div]:bg-success" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Medium Risk</span>
                    <span className="font-medium text-warning">32%</span>
                  </div>
                  <Progress value={32} className="h-2 bg-muted [&>div]:bg-warning" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">High Risk</span>
                    <span className="font-medium text-destructive">18%</span>
                  </div>
                  <Progress value={18} className="h-2 bg-muted [&>div]:bg-destructive" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Critical Risk</span>
                    <span className="font-medium text-risk-critical">5%</span>
                  </div>
                  <Progress value={5} className="h-2 bg-muted [&>div]:bg-risk-critical" />
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Average Risk Score</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{mockDashboardStats.averageRiskScore}</span>
                    <RiskBadge level="medium" size="sm" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Vendors */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Recent Vendors
              </CardTitle>
              <Link to="/vendors">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentVendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{vendor.name}</p>
                          <p className="text-xs text-muted-foreground">{vendor.industry}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{vendor.category}</TableCell>
                      <TableCell>
                        <RiskBadge level={vendor.riskLevel} score={vendor.riskScore} showScore size="sm" />
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          vendor.status === 'approved' ? 'bg-success/10 text-success' :
                          vendor.status === 'pending' ? 'bg-warning/10 text-warning' :
                          vendor.status === 'in-review' ? 'bg-accent/10 text-accent' :
                          'bg-destructive/10 text-destructive'
                        }`}>
                          {vendor.status.replace('-', ' ')}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Pending Assessments */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-accent" />
              Pending Assessments
            </CardTitle>
            <Link to="/assessments">
              <Button variant="ghost" size="sm" className="gap-1">
                View All
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingAssessments.map((assessment) => (
                <div
                  key={assessment.id}
                  className="p-4 rounded-lg border bg-card hover:shadow-card transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium">{assessment.vendorName}</p>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(assessment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      assessment.status === 'submitted' ? 'bg-accent/10 text-accent' :
                      assessment.status === 'in-progress' ? 'bg-warning/10 text-warning' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {assessment.status.replace('-', ' ')}
                    </span>
                  </div>
                  {assessment.aiSummary && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {assessment.aiSummary}
                    </p>
                  )}
                  <Button variant="outline" size="sm" className="w-full">
                    Review Assessment
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
