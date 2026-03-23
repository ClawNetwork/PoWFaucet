import React from 'react';
import { IFaucetConfig } from '../../common/FaucetConfig';
import { IFaucetContext } from '../../common/FaucetContext';
import { FaucetCaptcha } from '../shared/FaucetCaptcha';
import { GithubLogin } from './github/GithubLogin';
import { ZupassLogin } from './zupass/ZupassLogin';
import VoucherInput, { IVoucherInputRef } from './voucher/VoucherInput';
import { isEmbedMode } from '../../utils/EmbedMode';

export interface IFaucetInputProps {
  faucetContext: IFaucetContext;
  faucetConfig: IFaucetConfig
  defaultAddr?: string;
  submitInputs(inputs: any): Promise<void>;
}

export interface IFaucetInputState {
  submitting: boolean;
  targetAddr: string;
  smartAccountAddr?: string | null;
}

export class FaucetInput extends React.PureComponent<IFaucetInputProps, IFaucetInputState> {
  private faucetCaptcha = React.createRef<FaucetCaptcha>();
  private githubLogin = React.createRef<GithubLogin>();
  private zupassLogin = React.createRef<ZupassLogin>();
  private voucherInput = React.createRef<IVoucherInputRef>();
  private deriveTimer?: ReturnType<typeof setTimeout>;

  constructor(props: IFaucetInputProps) {
    super(props);

    this.state = {
      submitting: false,
      targetAddr: this.props.defaultAddr || "",
      smartAccountAddr: null,
		};
  }

  public componentDidMount() {
    if(this.state.targetAddr) {
      this.scheduleSmartAccountLookup(this.state.targetAddr);
    }
  }

  public componentWillUnmount() {
    if(this.deriveTimer) {
      clearTimeout(this.deriveTimer);
    }
  }

	public render(): React.ReactElement<IFaucetInputProps> {
    let needGithubAuth = !!this.props.faucetConfig.modules.github;
    let needZupassAuth = !!this.props.faucetConfig.modules.zupass && !!this.props.faucetConfig.modules.zupass.event;
    let needVoucher = !!this.props.faucetConfig.modules.voucher;
    let requestCaptcha = !!this.props.faucetConfig.modules.captcha?.requiredForStart;
    let inputTypes: string[] = [];
    if(this.props.faucetConfig.modules.ensname?.required) {
      inputTypes.push("ENS name");
    }
    else {
      inputTypes.push("ETH address");
      if(this.props.faucetConfig.modules.ensname)
        inputTypes.push("ENS name");
    }

    let submitBtnCaption: string;
    if(this.props.faucetConfig.modules.pow) {
      submitBtnCaption = isEmbedMode() ? "Start Clawing" : "Start Mining";
    }
    else {
      submitBtnCaption = "Request Funds";
    }

    return (
      <div className="faucet-inputs">
        <input 
          className="form-control" 
          value={this.state.targetAddr} 
          placeholder={"Please enter " + (inputTypes.join(" or "))} 
          onChange={(evt) => this.onTargetAddrChange(evt.target.value)} 
        />
        {this.state.smartAccountAddr ? (
          <div className="mt-2" style={{ fontSize: "0.9rem", color: "var(--bs-body-color)" }}>
            <div><strong>EOA / owner wallet:</strong> {this.state.targetAddr}</div>
            <div><strong>Gasless wallet (SimpleAccount):</strong> {this.state.smartAccountAddr}</div>
            <div style={{ opacity: 0.8, marginTop: "0.35rem" }}>
              {this.props.faucetConfig.faucetCoinSymbol || "CLAW"} will be sent to the gasless wallet (SimpleAccount).
            </div>
          </div>
        ) : null}
        {needGithubAuth ? 
          <GithubLogin 
            faucetConfig={this.props.faucetConfig} 
            faucetContext={this.props.faucetContext} 
            ref={this.githubLogin}
          />
        : null}
        {needZupassAuth ? 
          <React.Suspense fallback={<div>loading...</div>}>
            <ZupassLogin 
              faucetConfig={this.props.faucetConfig} 
              faucetContext={this.props.faucetContext} 
              ref={this.zupassLogin}
            />
          </React.Suspense>
        : null}
        {needVoucher ?
          <VoucherInput
            faucetConfig={this.props.faucetConfig}
            faucetContext={this.props.faucetContext}
            ref={this.voucherInput}
          />
        : null}
        {requestCaptcha ? 
          <div className='faucet-captcha'>
            <FaucetCaptcha 
              faucetConfig={this.props.faucetConfig} 
              ref={this.faucetCaptcha} 
              variant='session'
            />
          </div>
        : null}
        <div className="faucet-actions center">
          <button 
            className="btn btn-success start-action" 
            onClick={(evt) => this.onSubmitBtnClick()} 
            disabled={this.state.submitting}>
              {this.state.submitting ?
              <span className='inline-spinner'>
                <img src={(this.props.faucetContext.faucetUrls.imagesUrl || "/images") + "/spinner.gif"} className="spinner" />
              </span>
              : null}
              {submitBtnCaption}
          </button>
        </div>
      </div>
    );
	}

  private onTargetAddrChange(targetAddr: string) {
    this.setState({
      targetAddr,
      smartAccountAddr: null,
    });
    this.scheduleSmartAccountLookup(targetAddr);
  }

  private scheduleSmartAccountLookup(targetAddr: string) {
    if(this.deriveTimer) {
      clearTimeout(this.deriveTimer);
    }
    if(!targetAddr.match(/^0x[0-9a-fA-F]{40}$/) || targetAddr.match(/^0x0{40}$/i)) {
      return;
    }
    this.deriveTimer = setTimeout(() => {
      this.lookupSmartAccount(targetAddr);
    }, 250);
  }

  private async lookupSmartAccount(targetAddr: string) {
    try {
      let result = await this.props.faucetContext.faucetApi.deriveSmartAccount(targetAddr);
      if(this.state.targetAddr !== targetAddr) {
        return;
      }
      this.setState({
        smartAccountAddr: result?.success ? (result.smartAccountAddress || null) : null,
      });
    } catch(ex) {
      if(this.state.targetAddr === targetAddr) {
        this.setState({ smartAccountAddr: null });
      }
    }
  }

  private async onSubmitBtnClick() {
    this.setState({
      submitting: true
    });

    try {
      let inputData: any = {};

      inputData.addr = this.state.targetAddr;
      if(this.props.faucetConfig.modules.captcha?.requiredForStart) {
        inputData.captchaToken = await this.faucetCaptcha.current?.getToken();
      }
      if(this.props.faucetConfig.modules.github) {
        inputData.githubToken = await this.githubLogin.current?.getToken();
      }
      if(this.props.faucetConfig.modules.zupass && this.props.faucetConfig.modules.zupass.event) {
        inputData.zupassToken = await this.zupassLogin.current?.getToken();
      }
      if (this.props.faucetConfig.modules.voucher) {
        inputData.voucherCode = this.voucherInput.current?.getCode();
      }

      await this.props.submitInputs(inputData);
    } catch(ex) {
      if(this.faucetCaptcha.current)
        this.faucetCaptcha.current.resetToken();
      throw ex;
    } finally {
      this.setState({
        submitting: false
      });
    }
  }

}
