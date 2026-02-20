"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { Badge } from "@/components/ui/badge"

export default function ThemeTestPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Theme Test Page</h1>
          <p className="text-muted-foreground">Testing dark and light mode visibility</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sample Card 1</CardTitle>
              <CardDescription>This is a description to test text visibility</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                This text should be visible in both light and dark modes.
              </p>
              <div className="flex gap-2">
                <Button variant="default" size="sm">Primary</Button>
                <Button variant="outline" size="sm">Outline</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
            <CardHeader>
              <CardTitle>Gradient Card</CardTitle>
              <CardDescription>Testing gradient backgrounds</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground mb-4">
                This card has a gradient background that adapts to the theme.
              </p>
              <Badge variant="secondary">Theme Aware</Badge>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary">Accent Card</CardTitle>
              <CardDescription>Testing accent colors</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-card-foreground mb-4">
                This card uses primary colors for accents.
              </p>
              <Button variant="default" size="sm" className="w-full">
                Action Button
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Text Visibility Test</h2>
          <div className="space-y-2">
            <p className="text-foreground">Primary text (foreground)</p>
            <p className="text-muted-foreground">Muted text (muted-foreground)</p>
            <p className="text-primary">Primary colored text</p>
            <p className="text-secondary-foreground">Secondary text</p>
          </div>
        </div>
      </div>
    </div>
  )
}