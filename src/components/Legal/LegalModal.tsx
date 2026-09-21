import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Heading,
  Text,
  VStack,
  Box,
} from '@chakra-ui/react'
import { Button } from '../ui/Button'

export type LegalDoc = 'privacy' | 'terms'

// NOTE: 同じ文面が public/privacy.html と public/terms.html にもある（単独 URL 用）。
// ここを変えたら必ず両方も揃えること。弁護士レビューは受けていない。
const LAST_UPDATED = '2026-09-22'
const CONTACT_EMAIL = 'urushi1413@gmail.com'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Heading size="sm" mb={1}>
        {title}
      </Heading>
      <Text fontSize="sm" color="gray.700" whiteSpace="pre-wrap">
        {children}
      </Text>
    </Box>
  )
}

function Privacy() {
  return (
    <VStack align="stretch" spacing={4}>
      <Text fontSize="xs" color="gray.500">最終更新日: {LAST_UPDATED}</Text>
      <Section title="1. 取得する情報">
        メールアドレス、表示名などのプロフィール情報（Google でログインした場合は、Google アカウントの名前とメールアドレス）、利用者が共有を選択した場合の位置情報（緯度・経度と最終更新時刻）、作成した予定（外部カレンダーから取り込んだ予定を含む）、チャットおよびダイレクトメッセージの内容、チーム・フレンドの関係情報を取得します。
      </Section>
      <Section title="2. 位置情報の取り扱い">
        位置情報は、利用者が「共有範囲」を選択して明示的に共有した場合にのみ保存・共有されます。共有範囲（自分のみ／友だち／チーム）に応じて閲覧できる相手が制限され、閲覧者には位置とあわせて最終更新時刻が表示されます。共有を停止すると以後の共有は行われません。
      </Section>
      <Section title="3. 利用目的">
        本サービスの提供（位置・予定の共有、チャット、チーム/フレンド機能）、不正利用の防止、サービス改善のために利用します。
      </Section>
      <Section title="4. 第三者提供">
        法令に基づく場合を除き、利用者の同意なく第三者へ個人情報を提供しません。サービスの運用に必要な範囲で、データベース・認証基盤（Supabase）、ホスティング（Vercel）、エラー監視（Sentry）へ処理を委託します。エラー監視に送るのは利用者 ID と技術情報のみで、メールアドレス等は送信しません。
      </Section>
      <Section title="5. 保存期間と削除">
        チャットおよびダイレクトメッセージは、投稿から 30 日経過後に自動削除されます。利用者はアプリ内の「アカウントを削除」から、アカウントと関連データを完全に削除できます。
      </Section>
      <Section title="6. お問い合わせ">
        個人情報の開示・訂正・削除等のご請求は、運営者（{CONTACT_EMAIL}）までご連絡ください。
      </Section>
    </VStack>
  )
}

function Terms() {
  return (
    <VStack align="stretch" spacing={4}>
      <Text fontSize="xs" color="gray.500">最終更新日: {LAST_UPDATED}</Text>
      <Section title="1. 適用">
        本規約は、本サービスの利用に関する条件を、利用者と運営者の間で定めるものです。
      </Section>
      <Section title="2. アカウント">
        利用者は正確な情報で登録し、認証情報を適切に管理する責任を負います。
      </Section>
      <Section title="3. 禁止事項">
        法令・公序良俗に反する行為、他者の権利侵害、なりすまし、位置情報の不正取得・悪用、スパム、サービスの運営を妨げる行為を禁止します。
      </Section>
      <Section title="4. 位置情報の共有">
        位置情報の共有は利用者自身の選択に基づきます。共有相手の範囲を理解した上でご利用ください。
      </Section>
      <Section title="5. 免責">
        運営者は、本サービスの中断・データの消失・利用者間のトラブル等について、法令で認められる範囲で責任を負いません。
      </Section>
      <Section title="6. 規約の変更">
        運営者は必要に応じて本規約を変更できます。重要な変更はアプリ内で周知します。
      </Section>
    </VStack>
  )
}

interface LegalModalProps {
  doc: LegalDoc | null
  onClose: () => void
}

export function LegalModal({ doc, onClose }: LegalModalProps) {
  return (
    <Modal isOpen={doc !== null} onClose={onClose} isCentered size="lg" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.500" backdropFilter="blur(2px)" />
      <ModalContent mx={4}>
        <ModalHeader fontFamily="heading">
          {doc === 'terms' ? '利用規約' : 'プライバシーポリシー'}
        </ModalHeader>
        <ModalCloseButton borderRadius="full" />
        <ModalBody>{doc === 'terms' ? <Terms /> : <Privacy />}</ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            閉じる
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
