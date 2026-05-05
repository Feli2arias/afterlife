use {
    anchor_lang::{
        solana_program::instruction::Instruction,
        InstructionData, ToAccountMetas, AnchorSerialize,
    },
    litesvm::LiteSVM,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_keypair::Keypair,
    solana_transaction::versioned::VersionedTransaction,
};

fn build_register_ix(
    program_id: anchor_lang::prelude::Pubkey,
    owner: &Keypair,
) -> Instruction {
    use vigil::state::Beneficiary;

    let (vault_config, _) = anchor_lang::prelude::Pubkey::find_program_address(
        &[b"vigil", owner.pubkey().as_ref()],
        &program_id,
    );

    let beneficiaries = vec![Beneficiary {
        wallet: Keypair::new().pubkey(),
        share_bps: 10_000,
    }];

    let data = vigil::instruction::Register {
        beneficiaries,
        interval_days: 30,
        grace_period_days: 0,
    }
    .data();

    let accounts = vigil::accounts::Register {
        vault_config,
        owner: owner.pubkey(),
        system_program: anchor_lang::solana_program::system_program::ID,
    }
    .to_account_metas(None);

    Instruction::new_with_bytes(program_id, &data, accounts)
}

#[test]
fn test_register_vault() {
    let program_id = vigil::id();
    let owner = Keypair::new();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/vigil.so");
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();

    let ix = build_register_ix(program_id, &owner);
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&owner.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[owner]).unwrap();

    let res = svm.send_transaction(tx);
    assert!(res.is_ok(), "register failed: {:?}", res.err());
}
